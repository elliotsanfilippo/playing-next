import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `my-requests:${getClientIp(request)}`,
      60,
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
    const { requestIds } = body;

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    const safeRequestIds = requestIds
      .filter((id) => typeof id === "string")
      .slice(0, 50);

    /*
     * Explicit field list, not select("*"). This route is unauthenticated
     * by design (a guest looks up their own requests by ID from
     * localStorage), so it must never return internal fields like the
     * Stripe payment_intent_id or the financial breakdown
     * (request_amount/platform_fee/dj_earnings/etc) — those aren't needed
     * for the guest-facing "my requests" list and shouldn't be exposed to
     * whoever holds a request ID.
     */
    const { data, error } = await supabase
      .from("song_requests")
      /*
       * stripe_payment_intent_id is selected but never returned — it is
       * stripped below. It is here only to tell an abandoned checkout
       * apart from a genuinely expired request, and must not join the
       * response: this route is unauthenticated by design and returning
       * a Stripe identifier to whoever holds a request id would widen it
       * considerably.
       */
      .select(
        "id, song_title, artist, message, request_type, request_status, queue_position, is_vip, decline_reason, reported_not_played_at, stripe_payment_intent_id"
      )
      .in("id", safeRequestIds)
      .neq("request_status", "archived")
      /*
       * An unfinished checkout is not a request the guest made — it is
       * one they started. It used to be returned and rendered as
       * "Confirming Payment", so simply opening Stripe and closing it
       * put a request in My Requests that claimed a payment was being
       * confirmed when the guest may never have seen a payment form.
       *
       * The row still exists, and still matters for Stripe
       * reconciliation and for the pending-cap reservation. It is just
       * not something to show the guest until payment is authorised and
       * the status becomes "pending".
       */
      .neq("request_status", "checkout_pending")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    /*
     * An abandoned checkout ends up "expired" once its Stripe session
     * dies, and would otherwise reappear here as a request the guest
     * never actually made. The two kinds of expiry are told apart by
     * whether a payment was ever authorised: a request the DJ let time
     * out has a PaymentIntent, an abandoned checkout never got one.
     *
     * Deliberately narrow. Only "expired" is filtered this way, so a row
     * that ever reached authorisation can never be hidden from the guest
     * who paid for it.
     */
    const visible = (data || []).filter(
      (row) =>
        !(row.request_status === "expired" && !row.stripe_payment_intent_id)
    );

    /* Strip the Stripe id back out before it leaves the server. */
    const requests = visible.map((row) => {
      const rest = { ...row };
      delete (rest as { stripe_payment_intent_id?: string | null })
        .stripe_payment_intent_id;
      return rest;
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}