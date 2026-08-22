import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { expiryCutoffISO, REQUEST_EXPIRY_HOURS } from "@/src/lib/requestExpiry";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
 * Caps how much one run can chew through, so a backlog can't push the
 * function past its execution limit. Anything left over is simply
 * picked up by the next run.
 */
const BATCH_LIMIT = 100;

/*
 * Defence in depth for rows stuck mid-checkout.
 *
 * The primary mechanism is Stripe's own checkout.session.expired
 * webhook, plus the immediate cleanup when Session creation fails. This
 * sweep exists for everything those two cannot cover: a process that
 * died between creating the row and creating the session, a webhook that
 * never arrived, a delivery that failed every retry.
 *
 * A Stripe Checkout Session lives 24 hours by default and this code
 * never overrides that, so the threshold has to clear 24h with room to
 * spare — closing anything sooner could kill a session a guest is
 * genuinely still able to pay. 26 hours gives the webhook a two-hour
 * head start to do its job properly first.
 */
const STALE_CHECKOUT_HOURS = 26;

const staleCheckoutCutoffISO = () =>
  new Date(Date.now() - STALE_CHECKOUT_HOURS * 3_600_000).toISOString();

/*
 * Releases the card authorisation on requests the DJ never got round to
 * answering. Runs on a schedule (see vercel.json) rather than being
 * triggered by a user, so it authenticates with CRON_SECRET instead of
 * a session.
 *
 * Nothing here moves money: a pending request is authorised, never
 * captured, so this cancels the authorisation and the guest is never
 * charged. The matching "expired" status is what tells them that.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");

    return NextResponse.json(
      { error: "Scheduled tasks are not configured." },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const cutoff = expiryCutoffISO();

    const { data: staleRequests, error: loadError } = await supabaseAdmin
      .from("song_requests")
      .select("id, stripe_payment_intent_id")
      .eq("request_status", "pending")
      .lt("pending_at", cutoff)
      .limit(BATCH_LIMIT);

    if (loadError) {
      console.error("Expiry sweep load error:", loadError);

      return NextResponse.json(
        { error: "Unable to load expired requests." },
        { status: 500 }
      );
    }

    /*
     * No early return here any more. This used to bail out when there
     * were no stale *pending* requests, which is the common case — and
     * that skipped the stale-checkout and stale-tip sweeps below
     * entirely, so on any night where every request got answered, the
     * abandoned checkouts were never cleaned up at all.
     */
    let expired = 0;

    for (const songRequest of staleRequests ?? []) {
      const paymentIntentId = songRequest.stripe_payment_intent_id;

      if (!paymentIntentId) {
        console.error(
          "Pending request past expiry with no payment intent:",
          songRequest.id
        );
        continue;
      }

      let released = false;

      try {
        await stripe.paymentIntents.cancel(paymentIntentId, {
          cancellation_reason: "abandoned",
        });
        released = true;
      } catch {
        /*
         * Most likely the DJ captured or declined it in the moments
         * between the query above and this call. Re-read the intent so
         * an already-cancelled authorisation still gets its row tidied
         * up, while a captured one is left well alone.
         */
        const paymentIntent = await stripe.paymentIntents
          .retrieve(paymentIntentId)
          .catch(() => null);

        if (paymentIntent?.status === "canceled") {
          released = true;
        } else {
          console.error(
            "Could not release authorisation for request:",
            songRequest.id,
            paymentIntent?.status
          );
        }
      }

      if (!released) continue;

      /*
       * Still guarded on "pending" so a request the DJ accepted in the
       * meantime is never overwritten.
       */
      const { error: updateError } = await supabaseAdmin
        .from("song_requests")
        .update({ request_status: "expired" })
        .eq("id", songRequest.id)
        .eq("request_status", "pending");

      if (updateError) {
        console.error(
          "Expiry status update failed:",
          songRequest.id,
          updateError
        );
        continue;
      }

      expired += 1;
    }

    /*
     * ── Stale checkout sweep ─────────────────────────────────────────
     *
     * Transitions, never deletes. A row that has been mid-checkout for
     * more than a day is not going to complete, but the record still has
     * to exist: if a late event somehow arrives for it, there must be
     * something to reconcile against. Every write below is guarded on the
     * row still being in its unfinished state, so a guest who paid in the
     * meantime is untouched.
     */
    const checkoutCutoff = staleCheckoutCutoffISO();

    const { data: staleCheckouts, error: staleCheckoutError } =
      await supabaseAdmin
        .from("song_requests")
        .update({ request_status: "expired" })
        .eq("request_status", "checkout_pending")
        .lt("created_at", checkoutCutoff)
        .select("id");

    if (staleCheckoutError) {
      console.error("Stale checkout sweep failed:", staleCheckoutError);
    }

    const { data: staleTips, error: staleTipError } = await supabaseAdmin
      .from("tips")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("created_at", checkoutCutoff)
      .select("id");

    if (staleTipError) {
      console.error("Stale tip sweep failed:", staleTipError);
    }

    return NextResponse.json({
      expired,
      checked: staleRequests?.length ?? 0,
      expiryHours: REQUEST_EXPIRY_HOURS,
      staleCheckoutsClosed: staleCheckouts?.length ?? 0,
      staleTipsClosed: staleTips?.length ?? 0,
      staleCheckoutHours: STALE_CHECKOUT_HOURS,
    });
  } catch (error) {
    console.error("Request expiry sweep error:", error);

    return NextResponse.json(
      {
        error: "Expiry sweep failed.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
