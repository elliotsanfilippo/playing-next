import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";
import {
  SERVICE_FEE,
  FREE_PLATFORM_FEE_BPS,
  PRO_PLATFORM_FEE_BPS,
  PRICING_VERSION,
} from "@/src/lib/pricing";
import { isValidTipAmount } from "@/src/lib/tips";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type TipCheckoutBody = {
  djSlug?: string;
  amount?: number;
  message?: string;
};

/*
 * A tip has nothing for the DJ to accept or decline — there's no song,
 * no queue slot, nothing to fulfil — so unlike song requests this is a
 * single call that creates the row and starts checkout together, and
 * the charge captures automatically the moment the guest pays rather
 * than waiting on manual capture. transfer_data still splits it to the
 * DJ the same way a request does.
 */
export async function POST(request: NextRequest) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `tips-checkout:${getClientIp(request)}`,
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

    const body = (await request.json()) as TipCheckoutBody;

    const djSlug = body.djSlug?.trim().slice(0, 100);
    const amount = body.amount;
    const message = body.message?.trim().slice(0, 300) || null;

    if (!djSlug) {
      return NextResponse.json(
        { error: "Missing DJ." },
        { status: 400 }
      );
    }

    if (!amount || !isValidTipAmount(amount)) {
      return NextResponse.json(
        { error: "Please choose a valid tip amount." },
        { status: 400 }
      );
    }

    const { data: djProfile, error: profileError } = await supabase
      .from("dj_profiles")
      .select(
        "id, slug, stripe_account_id, stripe_connected, plan, stripe_subscription_status"
      )
      .eq("slug", djSlug)
      .maybeSingle();

    if (profileError || !djProfile) {
      return NextResponse.json(
        { error: "DJ could not be found." },
        { status: 404 }
      );
    }

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
     * Same active-Pro rule as everywhere else money is split — a
     * lapsed Pro payment falls back to the Free rate here too, not
     * just on song requests.
     */
    const isPro =
      djProfile.plan === "pro" &&
      djProfile.stripe_subscription_status === "active";

    const planAtCheckout: "free" | "pro" = isPro ? "pro" : "free";
    const platformFeeRateBps = isPro
      ? PRO_PLATFORM_FEE_BPS
      : FREE_PLATFORM_FEE_BPS;

    const platformFee = Math.round((amount * platformFeeRateBps) / 10_000);
    const djEarnings = amount - platformFee;
    const totalAmount = amount + SERVICE_FEE;

    const { data: tip, error: insertError } = await supabase
      .from("tips")
      .insert({
        dj_profile_id: djProfile.id,
        message,
        amount,
        guest_service_fee: SERVICE_FEE,
        platform_fee: platformFee,
        dj_earnings: djEarnings,
        total_amount: totalAmount,
        currency: "gbp",
        plan_at_checkout: planAtCheckout,
        platform_fee_rate_bps: platformFeeRateBps,
        pricing_version: PRICING_VERSION,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !tip) {
      console.error("Tip insert error:", insertError);

      return NextResponse.json(
        { error: "Something went wrong recording your tip." },
        { status: 500 }
      );
    }

    const origin = request.nextUrl.origin;

    const paymentMetadata: Record<string, string> = {
      type: "tip",
      tipId: tip.id,
      djSlug: djProfile.slug,
      amount: amount.toString(),
      guestServiceFee: SERVICE_FEE.toString(),
      platformFee: platformFee.toString(),
      djEarnings: djEarnings.toString(),
      totalAmount: totalAmount.toString(),
      planAtCheckout,
      platformFeeRateBps: platformFeeRateBps.toString(),
      pricingVersion: PRICING_VERSION,
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",

      payment_intent_data: {
        metadata: paymentMetadata,
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
              name: "Tip the DJ",
              description: message || undefined,
            },
            unit_amount: amount,
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
        `${origin}/api/stripe/tip-success` +
        `?session_id={CHECKOUT_SESSION_ID}` +
        `&tipId=${encodeURIComponent(tip.id)}` +
        `&djSlug=${encodeURIComponent(djProfile.slug)}`,

      cancel_url: `${origin}/request/${encodeURIComponent(djProfile.slug)}`,
    });

    if (!session.url) {
      console.error(
        "Tip Checkout Session did not return a URL:",
        session.id
      );

      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Tip checkout error:", error);

    return NextResponse.json(
      {
        error: "Unable to start checkout.",
        message: error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 }
    );
  }
}
