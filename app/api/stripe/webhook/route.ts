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
 *
 * We reuse the existing "declined" status for expiry/auto-cancel rather
 * than introducing a new status the UI doesn't know how to render —
 * the guest-facing meaning ("you were not charged") is accurate either
 * way, even if the copy says "DJ declined" rather than "expired".
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
