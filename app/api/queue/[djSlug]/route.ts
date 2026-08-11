import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";
import { isEffectivelyTakingRequests } from "@/src/lib/djActivity";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/*
 * Fully public, unauthenticated by design — meant to be displayed on a
 * screen at the venue. Deliberately narrow field selection: song title
 * and artist only. Never message content (a guest's private note to the
 * DJ) or anything guest-identifying — this is a public display, not a
 * guest-facing account view like /api/my-requests.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ djSlug: string }> }
) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `queue:${getClientIp(request)}`,
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
      .select("id, dj_name, profile_image_url, request_status, last_active_at")
      .eq("slug", djSlug)
      .maybeSingle();

    if (profileError || !djProfile) {
      return NextResponse.json({ error: "DJ not found." }, { status: 404 });
    }

    const { data: requests, error: requestsError } = await supabase
      .from("song_requests")
      .select(
        "song_title, artist, request_type, request_status, queue_position, is_vip"
      )
      .eq("dj_profile_id", djProfile.id)
      .in("request_status", ["playing_next", "accepted"])
      .order("queue_position", { ascending: true, nullsFirst: false });

    if (requestsError) {
      return NextResponse.json(
        { error: requestsError.message },
        { status: 500 }
      );
    }

    const nowPlaying =
      requests?.find((r) => r.request_status === "playing_next") ?? null;

    const upNext =
      requests
        ?.filter((r) => r.request_status === "accepted")
        .slice(0, 10) ?? [];

    return NextResponse.json({
      djName: djProfile.dj_name,
      djImage: djProfile.profile_image_url,
      isLive: isEffectivelyTakingRequests(djProfile),
      nowPlaying: nowPlaying
        ? {
            songTitle: nowPlaying.song_title,
            artist: nowPlaying.artist,
            isMessage: nowPlaying.request_type === "song_message",
            isVip: nowPlaying.is_vip === true,
          }
        : null,
      upNext: upNext.map((r) => ({
        songTitle: r.song_title,
        artist: r.artist,
        isMessage: r.request_type === "song_message",
        isVip: r.is_vip === true,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
