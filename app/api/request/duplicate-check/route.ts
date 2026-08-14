import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
 * Lets a guest know, before they pay, that a track is already in the
 * queue or was already played — informational only, not a block. A
 * popular song getting requested twice isn't necessarily a mistake
 * (it might just be genuinely popular), so the guest decides whether
 * to continue.
 *
 * "Played tonight" is scoped to today's date, matching the same
 * convention the dashboard already uses for "Tonight" revenue and
 * "Tips Today" — there's no formal event boundary yet.
 */
export async function GET(request: NextRequest) {
  try {
    const djSlug = request.nextUrl.searchParams.get("djSlug")?.trim();
    const spotifyTrackId = request.nextUrl.searchParams
      .get("spotifyTrackId")
      ?.trim();

    if (!djSlug || !spotifyTrackId) {
      return NextResponse.json(
        { error: "Missing DJ or track." },
        { status: 400 }
      );
    }

    const { data: djProfile, error: profileError } = await supabaseAdmin
      .from("dj_profiles")
      .select("id")
      .eq("slug", djSlug)
      .maybeSingle();

    if (profileError || !djProfile) {
      return NextResponse.json(
        { error: "DJ could not be found." },
        { status: 404 }
      );
    }

    const { data: matches, error: matchError } = await supabaseAdmin
      .from("song_requests")
      .select("request_status, created_at")
      .eq("dj_profile_id", djProfile.id)
      .eq("spotify_track_id", spotifyTrackId)
      .in("request_status", ["pending", "accepted", "playing_next", "played"]);

    if (matchError) {
      console.error("Duplicate check error:", matchError);
      return NextResponse.json({ alreadyRequested: false, alreadyPlayed: false });
    }

    const todayString = new Date().toDateString();

    const alreadyRequested = (matches ?? []).some((row) =>
      ["pending", "accepted", "playing_next"].includes(row.request_status)
    );

    const alreadyPlayed = (matches ?? []).some(
      (row) =>
        row.request_status === "played" &&
        new Date(row.created_at).toDateString() === todayString
    );

    return NextResponse.json({ alreadyRequested, alreadyPlayed });
  } catch (error) {
    console.error("Duplicate check route error:", error);

    return NextResponse.json({ alreadyRequested: false, alreadyPlayed: false });
  }
}
