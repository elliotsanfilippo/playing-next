import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REASON_MAX_LENGTH = 500;

/*
 * Guest self-serve "this wasn't played" report — same unauthenticated,
 * ID-is-proof-of-ownership trust model as /api/my-requests and
 * /api/request/cancel (guests have no accounts). Only allowed once a
 * request has actually been accepted (so there's something to have
 * played), and only once per request — reported_not_played_at is both
 * the guest-facing "already reported" flag and the idempotency guard.
 *
 * This does not move any money or contact the DJ. It only records the
 * report for later review (trust metrics, admin investigation) — see
 * the not_played_reports table. Actual payout holds/refunds are a
 * separate, deliberately unbuilt piece of this feature for now.
 */
export async function POST(request: NextRequest) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `report-not-played:${getClientIp(request)}`,
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
    const reason =
      typeof body.reason === "string"
        ? body.reason.trim().slice(0, REASON_MAX_LENGTH)
        : null;

    if (!requestId) {
      return NextResponse.json({ error: "Missing request ID." }, { status: 400 });
    }

    const { data: songRequest, error: requestError } = await supabase
      .from("song_requests")
      .select("id, dj_profile_id, request_status, reported_not_played_at")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !songRequest) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    if (songRequest.reported_not_played_at) {
      return NextResponse.json(
        { error: "You've already reported this request." },
        { status: 409 }
      );
    }

    if (!["accepted", "playing_next", "played"].includes(songRequest.request_status)) {
      return NextResponse.json(
        {
          error:
            "This request hasn't been accepted, so there's nothing to report yet.",
        },
        { status: 409 }
      );
    }

    const reportedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("song_requests")
      .update({ reported_not_played_at: reportedAt })
      .eq("id", requestId)
      .is("reported_not_played_at", null);

    if (updateError) {
      console.error("Not-played report status update failed:", updateError);

      return NextResponse.json(
        { error: "Unable to submit your report right now." },
        { status: 500 }
      );
    }

    const { error: insertError } = await supabase.from("not_played_reports").insert({
      song_request_id: songRequest.id,
      dj_profile_id: songRequest.dj_profile_id,
      reason,
    });

    if (insertError) {
      console.error("Not-played report insert failed:", insertError);

      return NextResponse.json(
        { error: "Unable to submit your report right now." },
        { status: 500 }
      );
    }

    return NextResponse.json({ reported: true, reportedAt });
  } catch (error) {
    console.error("Guest not-played report error:", error);

    return NextResponse.json(
      {
        error: "Unable to submit your report right now.",
      },
      { status: 500 }
    );
  }
}
