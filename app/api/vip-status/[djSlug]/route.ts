import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";
import {
  VIP_SLOT_LIMIT,
  CHECKOUT_RESERVATION_MINUTES,
} from "@/src/lib/pricing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/*
 * Public, unauthenticated by design — the request page needs to know
 * whether to grey out the VIP toggle before a guest has any request of
 * their own to authenticate with. Only ever returns a boolean, never
 * counts or any request data.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ djSlug: string }> }
) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `vip-status:${getClientIp(request)}`,
      30,
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

    const { djSlug } = await params;

    const { data: djProfile, error: profileError } = await supabase
      .from("dj_profiles")
      .select("id, max_pending_requests")
      .eq("slug", djSlug)
      .maybeSingle();

    if (profileError || !djProfile) {
      return NextResponse.json({ error: "DJ not found." }, { status: 404 });
    }

    const { count, error: countError } = await supabase
      .from("song_requests")
      .select("id", { count: "exact", head: true })
      .eq("dj_profile_id", djProfile.id)
      .eq("is_vip", true)
      .in("request_status", [
        "checkout_pending",
        "pending",
        "accepted",
        "playing_next",
      ]);

    if (countError) {
      console.error("VIP status count failed:", countError.message);

      return NextResponse.json(
        { error: "Something went wrong." },
        { status: 500 }
      );
    }

    /* Same reservation window as the create route, or the guest page
       would show "catching up" for checkouts the cap no longer counts. */
    const reservationCutoff = new Date(
      Date.now() - CHECKOUT_RESERVATION_MINUTES * 60_000
    ).toISOString();

    const [
      { count: livePending, error: livePendingError },
      { count: reserved, error: reservedError },
    ] = await Promise.all([
      supabase
        .from("song_requests")
        .select("id", { count: "exact", head: true })
        .eq("dj_profile_id", djProfile.id)
        .eq("request_status", "pending"),
      supabase
        .from("song_requests")
        .select("id", { count: "exact", head: true })
        .eq("dj_profile_id", djProfile.id)
        .eq("request_status", "checkout_pending")
        .gte("created_at", reservationCutoff),
    ]);

    const pendingCount = (livePending ?? 0) + (reserved ?? 0);
    const pendingCountError = livePendingError ?? reservedError;

    if (pendingCountError) {
      console.error("VIP status pending count failed:", pendingCountError.message);

      return NextResponse.json(
        { error: "Something went wrong." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      vipAvailable: (count ?? 0) < VIP_SLOT_LIMIT,
      pendingFull: (pendingCount ?? 0) >= djProfile.max_pending_requests,
    });
  } catch (error) {
    /* Detail stays server-side. The caller gets a fixed sentence. */
    console.error("VIP status route error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
