import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";

import {
  SERVICE_FEE,
  FREE_PLATFORM_FEE_BPS,
  PRICING_VERSION,
  DEFAULT_PLAN,
} from "@/src/lib/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CheckoutBody = {
  requestId?: string;
};

type RequestType = "song_request" | "song_message";

export async function POST(request: NextRequest) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `stripe-checkout:${getClientIp(request)}`,
      8,
      60_000
    );

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": retryAfterSeconds.toString() },
        }
      );
    }

    const body = (await request.json()) as CheckoutBody;
    const requestId = body.requestId?.trim();

    /*
     * Validate before attempting any database update.
     */
    if (!requestId) {
      return NextResponse.json(
        {
          error: "Missing request ID.",
        },
        { status: 400 }
      );
    }

    /*
     * Load the request from Supabase.
     *
     * Song details and request type come from the database rather
     * than from values supplied by the browser.
     */
    const {
      data: songRequest,
      error: requestError,
    } = await supabase
      .from("song_requests")
      .select(
        `
          id,
          song_title,
          artist,
          request_type,
          request_status,
          dj_profile_id
        `
      )
      .eq("id", requestId)
      .single();

    if (requestError || !songRequest) {
      console.error("Checkout request load error:", requestError);

      return NextResponse.json(
        {
          error: "Request could not be found.",
        },
        { status: 404 }
      );
    }

    if (songRequest.request_status !== "checkout_pending") {
      return NextResponse.json(
        {
          error: "This request is not awaiting checkout.",
        },
        { status: 409 }
      );
    }

    const requestType: RequestType =
      songRequest.request_type === "song_message"
        ? "song_message"
        : "song_request";

    /*
     * Load the DJ's real prices and slug.
     *
     * This prevents somebody from changing requestPrice in their
     * browser before calling the checkout route.
     */
    const {
      data: djProfile,
      error: profileError,
    } = await supabase
      .from("dj_profiles")
      .select(
        `
          id,
          slug,
          request_price,
          shoutout_price,
          stripe_account_id,
          stripe_connected
        `
      )
      .eq("id", songRequest.dj_profile_id)
      .single();

    if (profileError || !djProfile) {
      console.error("Checkout DJ profile load error:", profileError);

      return NextResponse.json(
        {
          error: "DJ profile could not be found.",
        },
        { status: 404 }
      );
    }

    /*
     * The DJ must have a fully onboarded, transfer-capable Stripe
     * Connect account before we let a guest pay — otherwise the
     * guest's money would be captured with nowhere for the DJ's
     * share to go.
     */
    if (!djProfile.stripe_account_id || !djProfile.stripe_connected) {
      return NextResponse.json(
        {
          error:
            "This DJ has not finished setting up payments yet. Please try again later.",
        },
        { status: 409 }
      );
    }

    /*
     * Select the correct price from the DJ profile.
     */
    const rawRequestAmount =
      requestType === "song_message"
        ? djProfile.shoutout_price
        : djProfile.request_price;

    const requestAmount =
      typeof rawRequestAmount === "number"
        ? rawRequestAmount
        : requestType === "song_message"
          ? 800
          : 500;

    if (
      !Number.isInteger(requestAmount) ||
      requestAmount <= 0
    ) {
      console.error(
        "Invalid DJ request price:",
        rawRequestAmount
      );

      return NextResponse.json(
        {
          error: "The DJ has an invalid request price.",
        },
        { status: 400 }
      );
    }

    /*
     * Pro subscriptions are not live yet, so DEFAULT_PLAN should
     * currently resolve to free.
     *
     * String() avoids TypeScript treating DEFAULT_PLAN as a value
     * that can never equal "pro".
     */
    const planAtCheckout: "free" | "pro" =
      String(DEFAULT_PLAN) === "pro"
        ? "pro"
        : "free";

    const platformFeeRateBps =
      planAtCheckout === "pro"
        ? 0
        : FREE_PLATFORM_FEE_BPS;

    const platformFee = Math.round(
      (requestAmount * platformFeeRateBps) / 10_000
    );

    const djEarnings = requestAmount - platformFee;
    const totalAmount = requestAmount + SERVICE_FEE;

    /*
     * Store a permanent snapshot of the pricing used for this
     * request. Historical values will therefore remain accurate if
     * prices or commission rates change later.
     */
    const {
      error: pricingUpdateError,
    } = await supabase
      .from("song_requests")
      .update({
        request_amount: requestAmount,
        guest_service_fee: SERVICE_FEE,
        platform_fee: platformFee,
        dj_earnings: djEarnings,
        total_amount: totalAmount,
        currency: "gbp",
        plan_at_checkout: planAtCheckout,
        platform_fee_rate_bps: platformFeeRateBps,
        pricing_version: PRICING_VERSION,
      })
      .eq("id", songRequest.id)
      .eq("request_status", "checkout_pending");

    if (pricingUpdateError) {
      console.error(
        "Financial snapshot save error:",
        pricingUpdateError
      );

      return NextResponse.json(
        {
          error: "Unable to save request pricing.",
          message: pricingUpdateError.message,
        },
        { status: 500 }
      );
    }

    const origin = request.nextUrl.origin;
    const safeDjSlug = djProfile.slug || "dj-elliot";

    /*
     * Metadata is added to both the Checkout Session and its
     * PaymentIntent because they are separate Stripe objects.
     */
    const paymentMetadata: Record<string, string> = {
      requestId: songRequest.id,
      songTitle: songRequest.song_title,
      artist: songRequest.artist,
      djSlug: safeDjSlug,
      requestType,

      requestAmount: requestAmount.toString(),
      guestServiceFee: SERVICE_FEE.toString(),
      platformFee: platformFee.toString(),
      djEarnings: djEarnings.toString(),
      totalAmount: totalAmount.toString(),

      planAtCheckout,
      platformFeeRateBps:
        platformFeeRateBps.toString(),
      pricingVersion: PRICING_VERSION,
    };

    const session =
      await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",

        payment_intent_data: {
          capture_method: "manual",
          metadata: paymentMetadata,

          /*
           * Delayed-capture destination charge: the transfer to the
           * DJ's connected account is created automatically by Stripe
           * the moment we capture (i.e. only once the DJ accepts).
           * Whatever isn't transferred (platformFee + SERVICE_FEE)
           * stays in the platform's own Stripe balance.
           */
          transfer_data: {
            destination: djProfile.stripe_account_id,
            amount: djEarnings,
          },
        },

        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: {
                name:
                  requestType === "song_message"
                    ? `Song + Message: ${songRequest.song_title}`
                    : `Song Request: ${songRequest.song_title}`,
                description: songRequest.artist,
              },
              unit_amount: requestAmount,
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "gbp",
              product_data: {
                name: "Guest Service Fee",
                description:
                  "Covers payment processing and platform costs.",
              },
              unit_amount: SERVICE_FEE,
            },
            quantity: 1,
          },
        ],

        metadata: paymentMetadata,

        success_url:
          `${origin}/api/stripe/success` +
          `?session_id={CHECKOUT_SESSION_ID}` +
          `&requestId=${encodeURIComponent(
            songRequest.id
          )}`,

        cancel_url:
          `${origin}/request/${encodeURIComponent(
            safeDjSlug
          )}`,
      });

    if (!session.url) {
      console.error(
        "Stripe Checkout Session did not return a URL:",
        session.id
      );

      return NextResponse.json(
        {
          error: "Stripe did not return a checkout URL.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    return NextResponse.json(
      {
        error: "Stripe checkout failed.",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      { status: 500 }
    );
  }
}