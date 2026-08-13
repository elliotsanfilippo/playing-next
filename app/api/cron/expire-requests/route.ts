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

    if (!staleRequests || staleRequests.length === 0) {
      return NextResponse.json({ expired: 0, checked: 0 });
    }

    let expired = 0;

    for (const songRequest of staleRequests) {
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

    return NextResponse.json({
      expired,
      checked: staleRequests.length,
      expiryHours: REQUEST_EXPIRY_HOURS,
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
