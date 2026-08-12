import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/*
 * Guest self-serve cancellation — the guest-side mirror of the DJ's own
 * decline path. Only ever touches "pending" requests, where the card is
 * authorised but not yet captured, so this can never claw back money
 * from a DJ. Same trust model as /api/my-requests: unauthenticated by
 * design (guests have no accounts), knowledge of the request ID is the
 * only "proof" of ownership there is — consistent with how the rest of
 * the guest flow already works, not a weaker standard introduced here.
 *
 * Refunding an already-captured request is a separate, harder problem
 * (it would mean pulling money back out of a DJ's Stripe balance after
 * they've already been paid) and isn't handled by this route.
 */
export async function POST(request: NextRequest) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `request-cancel:${getClientIp(request)}`,
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

    const body = await request.json();
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";

    if (!requestId) {
      return NextResponse.json({ error: "Missing request ID." }, { status: 400 });
    }

    const { data: songRequest, error: requestError } = await supabase
      .from("song_requests")
      .select("id, request_status, stripe_payment_intent_id")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !songRequest) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    if (songRequest.request_status !== "pending") {
      return NextResponse.json(
        {
          error:
            songRequest.request_status === "checkout_pending"
              ? "This request hasn't finished payment yet, so there's nothing to cancel."
              : `This request is already "${songRequest.request_status}" and can no longer be cancelled.`,
        },
        { status: 409 }
      );
    }

    if (!songRequest.stripe_payment_intent_id) {
      console.error("Pending request missing payment intent:", requestId);

      return NextResponse.json(
        { error: "This request can't be cancelled right now." },
        { status: 500 }
      );
    }

    /*
     * The cancellation reason is what lets the webhook tell a guest
     * cancelling their own request apart from a DJ declining it or
     * Stripe auto-cancelling an uncaptured authorisation — all three
     * arrive as the same payment_intent.canceled event. Without it,
     * whichever of the two writes below lands first would decide the
     * guest's status, which is a race.
     */
    await stripe.paymentIntents.cancel(songRequest.stripe_payment_intent_id, {
      cancellation_reason: "requested_by_customer",
    });

    const { error: updateError } = await supabase
      .from("song_requests")
      .update({ request_status: "cancelled" })
      .eq("id", requestId)
      .eq("request_status", "pending");

    if (updateError) {
      console.error("Guest cancel status update failed:", updateError);

      return NextResponse.json(
        { error: "Payment was cancelled but the status update failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({ cancelled: true });
  } catch (error) {
    console.error("Guest request cancel error:", error);

    return NextResponse.json(
      {
        error: "Unable to cancel this request.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
