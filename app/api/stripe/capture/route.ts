import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/*
 * Financial data — written server-side via the service role, not the
 * DJ's own RLS-scoped client, matching how every other money field on
 * this table is set (checkout route, webhook).
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentIntentId, requestId, accessToken } = body;

    if (!paymentIntentId || !requestId || !accessToken) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorised" },
        { status: 401 }
      );
    }

    const { data: songRequest, error: requestError } = await supabase
      .from("song_requests")
      .select(
        "id, request_status, stripe_payment_intent_id, dj_profile_id, dj_profiles!inner(user_id, max_queue_requests)"
      )
      .eq("id", requestId)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .single();

    if (requestError || !songRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    const profile = Array.isArray(songRequest.dj_profiles)
      ? songRequest.dj_profiles[0]
      : songRequest.dj_profiles;

    if (profile.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    /*
     * A request can only be captured once, from "pending". This is a
     * fast-fail for double-clicks/retries — Stripe itself also refuses
     * to capture a PaymentIntent twice, but checking here first avoids
     * an unnecessary Stripe call and gives a clearer error.
     */
    /*
     * A retry after a lost response is not an error.
     *
     * The DJ tapped Accept, the work completed, and the response never
     * reached their phone — a normal event on venue wifi. Answering that
     * with a red error would tell them the accept failed when the guest
     * has already been charged and queued. It is reported as success,
     * with the canonical row, and the client simply renders server truth.
     */
    if (songRequest.request_status === "accepted") {
      return NextResponse.json({ alreadyAccepted: true, request: songRequest });
    }

    if (songRequest.request_status !== "pending") {
      return NextResponse.json(
        {
          error: `This request is already "${songRequest.request_status}" and cannot be captured again.`,
        },
        { status: 409 }
      );
    }

    /*
     * No PaymentIntent means no money to capture, and there is no
     * legitimate request in that state to accept.
     *
     * Checked against live data while auditing: the transition to
     * "pending" and the recording of the PaymentIntent are written
     * together, in the same statement, by both the /api/stripe/success
     * redirect and the checkout.session.completed webhook. Every row
     * without one is checkout_pending, expired, or predates the
     * financial columns entirely — none of which should become accepted.
     *
     * The browser used to skip the whole server call in this case and
     * write "accepted" itself. That was the one path where a status
     * transition happened with no ownership check, no prior-status check
     * and no queue-cap check, so it is refused here rather than
     * preserved.
     */
    if (!songRequest.stripe_payment_intent_id) {
      return NextResponse.json(
        {
          error:
            "This request has no payment attached and cannot be accepted.",
        },
        { status: 409 }
      );
    }

    /*
     * Caps how many songs a DJ can have already accepted and waiting
     * to play. Checked before capturing so a queue that's genuinely
     * full never takes a guest's money for an accept that can't
     * actually happen — the request itself is untouched, still
     * pending, so the DJ can still accept it once they've played
     * something and freed a slot.
     */
    const { count: queueCount, error: queueCountError } = await supabase
      .from("song_requests")
      .select("id", { count: "exact", head: true })
      .eq("dj_profile_id", songRequest.dj_profile_id)
      .in("request_status", ["accepted", "playing_next"]);

    if (queueCountError) {
      console.error("Queue count error:", queueCountError);

      return NextResponse.json(
        { error: "Unable to accept this request." },
        { status: 500 }
      );
    }

    if ((queueCount ?? 0) >= profile.max_queue_requests) {
      return NextResponse.json(
        {
          error:
            "Your queue is full. Mark something as played to free up a slot.",
        },
        { status: 409 }
      );
    }

    /*
     * ── Reconciliation, and why there is no webhook for it ───────────
     *
     * Capturing money and transitioning the row are two systems, so this
     * cannot be one atomic operation and should not pretend to be. What
     * it can be is idempotent, and Stripe already stores the fact that
     * decides everything: the PaymentIntent's own status.
     *
     * Reading it first turns the dangerous case into an ordinary one.
     * "Capture succeeded but the database write failed" leaves a row
     * still pending against a PaymentIntent that is already succeeded —
     * and on the next Accept this finds exactly that, skips the capture,
     * and completes the transition that was missed. The DJ recovers by
     * pressing the button again, which is what they would do anyway.
     *
     * The previous code went straight to capture, so that same retry hit
     * Stripe's "already captured" error, returned a 500, and left the
     * request permanently stuck: money taken, guest charged, row pending,
     * and no way out of it from the UI.
     *
     * A payment_intent.succeeded webhook was considered and rejected. It
     * would repair the row eventually, but only eventually — the DJ is
     * standing in a booth watching a request they believe failed, and a
     * webhook cannot tell them anything in that moment. Reading the
     * PaymentIntent on the path the DJ is already retrying fixes it
     * immediately, adds no new delivery surface to secure, and keeps the
     * money decision in the one place that actually knows: Stripe.
     */
    const existing = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });

    let paymentIntent = existing;

    if (existing.status === "requires_capture") {
      paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      });
    } else if (existing.status !== "succeeded") {
      /*
       * Anything else — canceled, requires_payment_method, processing —
       * is not money this DJ can accept, and guessing would be worse
       * than refusing. The row stays pending and the guest stays
       * uncharged.
       */
      return NextResponse.json(
        {
          error: `This payment is "${existing.status}" and can't be accepted. Refresh to see its current state.`,
        },
        { status: 409 }
      );
    }

    /*
     * Stripe's actual processing fee for this specific charge — not
     * estimated, read straight off the real balance transaction.
     * Best-effort: if the fee isn't available for some reason, that
     * shouldn't block the DJ's request from being accepted.
     */
    const charge = paymentIntent.latest_charge;
    const balanceTransaction =
      charge && typeof charge === "object" ? charge.balance_transaction : null;
    const stripeFee =
      balanceTransaction && typeof balanceTransaction === "object"
        ? balanceTransaction.fee
        : null;

    /* Written as part of the accept below rather than on its own, so the
       fee and the status land in one statement instead of two. */
    if (stripeFee === null) {
      console.error(
        "Stripe fee unavailable on capture for request:",
        requestId
      );
    }

    /*
     * ── The transition, server-side and conditional ──────────────────
     *
     * This used to be the browser's job: capture here, then a separate
     * supabase.update() from the dashboard with only .eq("id"). Two
     * problems came with that. The write could fail after the money had
     * moved, and it carried no expectation about the row's current
     * state, so a stale tab could drive any status into "accepted".
     *
     * .eq("request_status", "pending") makes this a compare-and-set.
     * Two devices accepting the same request race here rather than in
     * the UI: the first wins, the second matches zero rows and is told
     * the truth instead of overwriting it.
     */
    const { data: accepted, error: acceptError } = await supabaseAdmin
      .from("song_requests")
      .update({
        request_status: "accepted",
        accepted_at: new Date().toISOString(),
        ...(stripeFee !== null ? { stripe_fee: stripeFee } : {}),
      })
      .eq("id", requestId)
      .eq("request_status", "pending")
      .select()
      .maybeSingle();

    if (acceptError) {
      /*
       * The money is captured and the row is not. Deliberately reported
       * as a retryable failure rather than a success: the retry now
       * finds the PaymentIntent already succeeded and completes this
       * same transition, so the DJ recovers by pressing Accept again.
       */
      console.error("Accept transition failed after capture:", acceptError);

      return NextResponse.json(
        {
          error:
            "The payment went through but we couldn't update this request. Press Accept again to finish it.",
        },
        { status: 500 }
      );
    }

    if (!accepted) {
      /* Zero rows matched: something else moved this request between the
         status check above and this write. Server truth wins. */
      return NextResponse.json(
        {
          error:
            "This request just changed somewhere else. Refreshing to show its current state.",
        },
        { status: 409 }
      );
    }

    /*
     * Queue position is assigned by the same RPC the dashboard already
     * uses, called with the DJ's own token rather than the service role —
     * reorder_dj_queue derives its DJ from auth.uid(), so it must run as
     * the DJ. A failure here leaves the request accepted and paid with a
     * null position, which sorts to the end of its tier rather than
     * losing it, so it is logged and not treated as fatal.
     */
    const { error: reorderError } = await supabase.rpc("reorder_dj_queue");

    if (reorderError) {
      console.error("Queue resequence after accept failed:", reorderError);
    }

    return NextResponse.json({ request: accepted, paymentIntent });
  } catch (error) {
    console.log("Stripe capture error:", error);

    return NextResponse.json(
      {
        error: "Stripe capture failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}