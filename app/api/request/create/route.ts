import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";
import {
  VIP_SLOT_LIMIT,
  CHECKOUT_RESERVATION_MINUTES,
} from "@/src/lib/pricing";
import { isEffectivelyTakingRequests } from "@/src/lib/djActivity";
import {
  MESSAGE_REJECTED_COPY,
  messageNeedsRewording,
} from "@/src/lib/messageModeration";

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

type CreateRequestBody = {
  djSlug?: string;
  songTitle?: string;
  artist?: string;
  spotifyTrackId?: string;
  requestType?: "song_request" | "song_message";
  message?: string;
  isVip?: boolean;
};

/*
 * Creates a song_requests row server-side, using the service role key.
 * This exists so guests never need direct anon SELECT/INSERT access to
 * song_requests from the browser — that table can hold other guests'
 * private shoutout messages, and RLS can't scope "read only the row
 * whose ID I already know" from "read every row", so the only clean fix
 * is moving reads and writes here instead of loosening a table-wide
 * policy.
 */
export async function POST(request: NextRequest) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `request-create:${getClientIp(request)}`,
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

    const body = (await request.json()) as CreateRequestBody;

    const djSlug = body.djSlug?.trim().slice(0, 100);
    const songTitle = body.songTitle?.trim().slice(0, 300);
    const artist = body.artist?.trim().slice(0, 300);
    const spotifyTrackId = body.spotifyTrackId?.trim().slice(0, 100) || null;
    const requestType =
      body.requestType === "song_message" ? "song_message" : "song_request";
    const message = body.message?.trim().slice(0, 500) || null;
    const isVip = body.isVip === true;

    if (!djSlug || !songTitle || !artist) {
      return NextResponse.json(
        { error: "Missing song, artist or DJ." },
        { status: 400 }
      );
    }

    if (requestType === "song_message" && !message) {
      return NextResponse.json(
        { error: "Please add a message for your Song + Message request." },
        { status: 400 }
      );
    }

    /*
     * Enforced here rather than only in the browser, since the client
     * check is a courtesy and this route is public.
     */
    if (messageNeedsRewording(message)) {
      return NextResponse.json(
        { error: MESSAGE_REJECTED_COPY },
        { status: 400 }
      );
    }

    const { data: djProfile, error: profileError } = await supabaseAdmin
      .from("dj_profiles")
      .select(
        "id, request_status, last_active_at, auto_close_at, max_pending_requests"
      )
      .eq("slug", djSlug)
      .maybeSingle();

    if (profileError || !djProfile) {
      return NextResponse.json(
        { error: "DJ could not be found." },
        { status: 404 }
      );
    }

    if (!isEffectivelyTakingRequests(djProfile)) {
      return NextResponse.json(
        { error: "This DJ is not taking requests right now." },
        { status: 409 }
      );
    }

    /*
     * Caps how many unanswered requests a DJ can have at once.
     *
     * checkout_pending still counts, for the original reason: several
     * guests mid-checkout at the same moment could otherwise all pass
     * this check and push the real pending count past the cap once they
     * finish paying. But it now only counts for a bounded window —
     * previously an abandoned checkout held its slot forever, so a
     * handful of people opening Stripe and wandering off could tell every
     * later guest the DJ was full when nothing was waiting at all.
     *
     * Counted in two parts because they are two different questions:
     * everything genuinely pending, plus only the recent reservations.
     */
    const reservationCutoff = new Date(
      Date.now() - CHECKOUT_RESERVATION_MINUTES * 60_000
    ).toISOString();

    const [{ count: livePending, error: livePendingError }, { count: reserved, error: reservedError }] =
      await Promise.all([
        supabaseAdmin
          .from("song_requests")
          .select("id", { count: "exact", head: true })
          .eq("dj_profile_id", djProfile.id)
          .eq("request_status", "pending"),
        supabaseAdmin
          .from("song_requests")
          .select("id", { count: "exact", head: true })
          .eq("dj_profile_id", djProfile.id)
          .eq("request_status", "checkout_pending")
          .gte("created_at", reservationCutoff),
      ]);

    const pendingCount = (livePending ?? 0) + (reserved ?? 0);
    const pendingCountError = livePendingError ?? reservedError;

    if (pendingCountError) {
      console.error("Pending count error:", pendingCountError);

      return NextResponse.json(
        { error: "Unable to create your request." },
        { status: 500 }
      );
    }

    if ((pendingCount ?? 0) >= djProfile.max_pending_requests) {
      return NextResponse.json(
        {
          /* The pending cap, not the accepted queue cap — the old copy
             described the wrong limit, the same conflation fixed on the
             guest page in 4A. */
          error:
            "This DJ has too many requests waiting for a decision right now. Try again in a few minutes.",
        },
        { status: 409 }
      );
    }

    if (isVip) {
      const { count: vipCount, error: vipCountError } = await supabaseAdmin
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

      if (vipCountError) {
        console.error("VIP count error:", vipCountError);

        return NextResponse.json(
          { error: "Unable to create your request." },
          { status: 500 }
        );
      }

      if ((vipCount ?? 0) >= VIP_SLOT_LIMIT) {
        return NextResponse.json(
          { error: "All VIP slots are taken right now." },
          { status: 409 }
        );
      }
    }

    const { data: existingRequests, error: countError } = await supabaseAdmin
      .from("song_requests")
      .select("id")
      .eq("dj_profile_id", djProfile.id)
      .in("request_status", ["pending", "accepted", "playing_next"]);

    if (countError) {
      console.error("Queue position count error:", countError);

      return NextResponse.json(
        { error: "Unable to create your request." },
        { status: 500 }
      );
    }

    const nextQueuePosition = (existingRequests?.length || 0) + 1;

    /*
     * Resolved server-side rather than trusting an eventId from the
     * client — same reasoning as the price re-derivation in the
     * checkout route.
     */
    const { data: activeEvent } = await supabaseAdmin
      .from("dj_events")
      .select("id")
      .eq("dj_profile_id", djProfile.id)
      .eq("is_active", true)
      .maybeSingle();

    const { data, error } = await supabaseAdmin
      .from("song_requests")
      .insert({
        dj_profile_id: djProfile.id,
        song_title: songTitle,
        artist,
        spotify_track_id: spotifyTrackId,
        event_id: activeEvent?.id ?? null,
        request_status: "checkout_pending",
        queue_position: nextQueuePosition,
        request_type: requestType,
        message: requestType === "song_message" ? message : null,
        is_vip: isVip,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Request create error:", error);

      return NextResponse.json(
        { error: "Something went wrong creating your request." },
        { status: 500 }
      );
    }

    return NextResponse.json({ requestId: data.id });
  } catch (error) {
    console.error("Request create route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 }
    );
  }
}
