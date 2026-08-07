import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/*
 * Reconciliation for the cases nothing else in the app catches:
 * - A guest opens Stripe Checkout but never completes it. The session
 *   expires after 24h and the request would otherwise sit in
 *   "checkout_pending" forever.
 * - Stripe automatically cancels an uncaptured manual-capture
 *   PaymentIntent after 7 days if the DJ never accepts or declines.
 * - The DJ's Connect account capabilities change (e.g. Stripe requires
 *   more info, or onboarding finishes) — previously this only synced
 *   when a DJ happened to reload the payments settings page.
 * - A captured payment is refunded, or disputed, outside the app
 *   entirely (Stripe Dashboard, or the cardholder's bank). Without this,
 *   the request would keep showing "Playing Next"/"Played" to the guest
 *   even though the money has moved back.
 *
 * We reuse the existing "declined" status for expiry/auto-cancel, since
 * the guest-facing meaning ("you were not charged") is accurate either
 * way. Refunds and disputes get their own statuses ("refunded",
 * "disputed") because, unlike a decline, a payment genuinely was taken
 * first — telling the guest "declined" there would be inaccurate.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);

    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const requestId = session.metadata?.requestId;

        if (requestId) {
          await supabaseAdmin
            .from("song_requests")
            .update({ request_status: "declined" })
            .eq("id", requestId)
            .eq("request_status", "checkout_pending");
        }

        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const requestId = paymentIntent.metadata?.requestId;

        if (requestId) {
          await supabaseAdmin
            .from("song_requests")
            .update({ request_status: "declined" })
            .eq("id", requestId)
            .in("request_status", ["checkout_pending", "pending"]);
        }

        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;

        /*
         * Only act on a full refund. A partial refund doesn't change
         * whether the request was fulfilled, so it's left for manual
         * review rather than guessed at here.
         */
        if (paymentIntentId && charge.amount_refunded >= charge.amount) {
          await supabaseAdmin
            .from("song_requests")
            .update({ request_status: "refunded" })
            .eq("stripe_payment_intent_id", paymentIntentId)
            .in("request_status", ["accepted", "playing_next", "played"]);
        }

        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id;

        if (paymentIntentId) {
          await supabaseAdmin
            .from("song_requests")
            .update({ request_status: "disputed" })
            .eq("stripe_payment_intent_id", paymentIntentId);
        }

        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;

        const detailsSubmitted = account.details_submitted;
        const payoutsEnabled = account.payouts_enabled;
        const transfersActive = account.capabilities?.transfers === "active";
        const currentlyDue = account.requirements?.currently_due ?? [];

        const connected =
          Boolean(detailsSubmitted) &&
          Boolean(payoutsEnabled) &&
          transfersActive &&
          currentlyDue.length === 0;

        await supabaseAdmin
          .from("dj_profiles")
          .update({ stripe_connected: connected })
          .eq("stripe_account_id", account.id);

        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handler error:", error);

    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
