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
      .select(
        "id, song_title, artist, message, request_type, request_status, queue_position, is_vip, decline_reason"
      )
      .in("id", safeRequestIds)
      .neq("request_status", "archived")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      requests: data || [],
    });
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