import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendPushToDJ } from "@/src/lib/webpush";
import { checkAndMarkQrBoxEligible } from "@/src/lib/qrBoxIncentive";

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
 * - A guest completes Stripe Checkout but their browser never makes it
 *   back to /api/stripe/success (closed tab, dropped connection, a
 *   blocked redirect). Without this, the request — and the payment
 *   Stripe already took — would be stuck showing "Confirming Payment"
 *   forever, and the DJ would never even see it to accept or decline.
 *   checkout.session.completed is the server-side source of truth for
 *   that transition; the client redirect is just the fast path for a
 *   guest who's still watching their screen.
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
 * - A DJ's Pro subscription status changes (new subscription, payment
 *   failure, cancellation) — keeps dj_profiles.plan and
 *   stripe_subscription_status in sync so the checkout route always
 *   charges the correct platform fee.
 *
 * We reuse the existing "declined" status for expiry/auto-cancel, since
 * the guest-facing meaning ("you were not charged") is accurate either
 * way. A guest cancelling their own request gets "cancelled" instead —
 * same money outcome, but telling someone the DJ declined a request
 * they withdrew themselves is just wrong. Refunds and disputes get
 * their own statuses ("refunded", "disputed") because, unlike a
 * decline, a payment genuinely was taken first.
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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const requestId = session.metadata?.requestId;

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        if (requestId && paymentIntentId) {
          /*
           * Guarded on the current status still being "checkout_pending"
           * so this is a no-op on the common path where the guest's
           * browser already completed the /api/stripe/success redirect
           * — only the browser-never-made-it-back case actually needs
           * this to do anything.
           */
          const { data: updatedRequests, error: updateError } =
            await supabaseAdmin
              .from("song_requests")
              .update({
                request_status: "pending",
                stripe_payment_intent_id: paymentIntentId,
              })
              .eq("id", requestId)
              .eq("request_status", "checkout_pending")
              .select("dj_profile_id, song_title, artist, request_type");

          if (updateError) {
            console.error(
              "Webhook checkout.session.completed update error:",
              updateError
            );
          } else if (updatedRequests && updatedRequests.length > 0) {
            const updated = updatedRequests[0];

            sendPushToDJ(updated.dj_profile_id, {
              title:
                updated.request_type === "song_message"
                  ? "New Song + Message request"
                  : "New song request",
              body: `${updated.song_title} — ${updated.artist}`,
              url: "/dj/dashboard",
            }).catch((pushError) => {
              console.error("Push notification error:", pushError);
            });
          }
        }

        break;
      }

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

        /*
         * A guest cancelling their own request, a DJ declining it, and
         * Stripe auto-cancelling an uncaptured authorisation all land
         * here identically. Only the guest's own cancellation sets
         * "requested_by_customer", so that's what separates "you
         * cancelled this" from "the DJ couldn't take it".
         */
        const nextStatus =
          paymentIntent.cancellation_reason === "requested_by_customer"
            ? "cancelled"
            : "declined";

        if (requestId) {
          await supabaseAdmin
            .from("song_requests")
            .update({ request_status: nextStatus })
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

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        /*
         * A subscription that's ended (cancelled, or never completed
         * payment) puts the DJ back on Free. Anything else — active,
         * trialing, even past_due/unpaid while a card retries — keeps
         * them marked as Pro; the 0% fee itself is gated separately in
         * the checkout route on stripe_subscription_status === "active",
         * so a lapsed payment falls back to the 15% fee automatically
         * without needing to flip plan back and forth here too.
         */
        const terminalStatuses = ["canceled", "incomplete_expired"];
        const plan = terminalStatuses.includes(subscription.status)
          ? "free"
          : "pro";

        const { data: updatedProfiles } = await supabaseAdmin
          .from("dj_profiles")
          .update({
            stripe_subscription_id: subscription.id,
            stripe_subscription_status: subscription.status,
            plan,
          })
          .eq("stripe_customer_id", customerId)
          .select("id");

        if (plan === "pro" && updatedProfiles && updatedProfiles.length > 0) {
          await checkAndMarkQrBoxEligible(updatedProfiles[0].id);
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
