import { NextRequest, NextResponse } from "next/server";
import { resolveEffectiveEvent } from "@/src/lib/activeEvent";
import { isProEntitled } from "@/src/lib/planEntitlement";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";
import { SERVICE_FEE, PRICING_VERSION } from "@/src/lib/pricing";
import { isValidTipAmount, TIP_MESSAGE_MAX_LENGTH } from "@/src/lib/tips";
import {
  CONNECT_NOT_READY_MESSAGE,
  CONNECT_SELECT,
  logConnectNotReady,
  resolveConnectAccount,
} from "@/src/lib/stripeEnvironment";
import {
  MESSAGE_REJECTED_COPY,
  messageNeedsRewording,
} from "@/src/lib/messageModeration";

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
  /* Visible to the catch block so a failed Session creation can close
     the tip row instead of leaving it pending forever. */
  let createdTipId: string | null = null;

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
    const message = body.message?.trim().slice(0, TIP_MESSAGE_MAX_LENGTH) || null;

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

    /*
     * Guest-authored tip messages go through the same matcher as Song +
     * Message shoutouts, and for the same reason: this is stranger-written
     * text that ends up in front of the DJ and, at a wedding or a
     * corporate gig, frequently read out loud. Only the request path was
     * ever checked, so the tip field was an open channel to the same
     * audience.
     *
     * Rejected before the row is inserted and before Stripe is touched,
     * so a rejected message leaves no tip row and no payment flow behind.
     * The offending text is never echoed back.
     *
     * Only the guest's own message is moderated. DJ names, song titles
     * and artist names are not — those legitimately contain profanity and
     * filtering them would block real songs and real people.
     */
    if (messageNeedsRewording(message)) {
      return NextResponse.json(
        { error: MESSAGE_REJECTED_COPY },
        { status: 400 }
      );
    }

    const { data: djProfile, error: profileError } = await supabase
      .from("dj_profiles")
      .select(
        `id, slug, plan, stripe_subscription_status, ${CONNECT_SELECT}`
      )
      .eq("slug", djSlug)
      .maybeSingle();

    if (profileError || !djProfile) {
      return NextResponse.json(
        { error: "DJ could not be found." },
        { status: 404 }
      );
    }

    /* Same environment resolution and the same gate as the request
       checkout route: blocked only when a destination transfer cannot
       land, not when bank payouts are merely paused. */
    const connect = resolveConnectAccount(djProfile);

    if (!connect.accountId || !connect.connected) {
      logConnectNotReady("tips/checkout", djProfile.slug);

      return NextResponse.json(
        { error: CONNECT_NOT_READY_MESSAGE },
        { status: 409 }
      );
    }

    /*
     * plan_at_checkout is still recorded for reporting, but unlike a
     * song request, a tip pays out 100% to the DJ regardless of plan —
     * the Free-plan platform fee only applies to paid requests. Only
     * the flat guest service fee applies here.
     */
    const isPro = isProEntitled(djProfile);

    const planAtCheckout: "free" | "pro" = isPro ? "pro" : "free";
    const platformFeeRateBps = 0;
    const platformFee = 0;
    const djEarnings = amount;
    const totalAmount = amount + SERVICE_FEE;

    /* Same shared resolver as request creation, so a lapsed Pro
       subscription stops tagging tips with an event too. */
    const activeEvent = await resolveEffectiveEvent(supabase, djProfile);

    const { data: tip, error: insertError } = await supabase
      .from("tips")
      .insert({
        dj_profile_id: djProfile.id,
        event_id: activeEvent?.id ?? null,
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

    createdTipId = tip.id;

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
          destination: connect.accountId,
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

    /* Same fail-closed rule as the request path: never redirect into a
       session we could not record. See app/api/stripe/checkout. */
    const { error: sessionIdError } = await supabase
      .from("tips")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", tip.id)
      .eq("status", "pending");

    if (sessionIdError) {
      console.error("Failed to persist tip session id; expiring session:", {
        tipId: tip.id,
        sessionId: session.id,
        sessionIdError,
      });

      await stripe.checkout.sessions
        .expire(session.id)
        .catch((expireError) => {
          console.error("Could not expire unrecorded tip session:", expireError);
        });

      return NextResponse.json(
        { error: "We couldn't start checkout securely. Please try again." },
        { status: 500 }
      );
    }

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

    /*
     * No session exists, so checkout.session.expired can never fire for
     * this tip. Without this the row sits at "pending" permanently — the
     * exact defect that left two abandoned tips in the table. Closed by
     * transition, never by deletion.
     */
    if (createdTipId) {
      const { error: cleanupError } = await supabase
        .from("tips")
        .update({ status: "expired" })
        .eq("id", createdTipId)
        .eq("status", "pending");

      if (cleanupError) {
        console.error("Tip checkout failure cleanup error:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        error: "Unable to start checkout.",
      },
      { status: 500 }
    );
  }
}
