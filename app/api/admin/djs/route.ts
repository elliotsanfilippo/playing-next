import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/src/lib/adminAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ACCEPTED_EVER_STATUSES = ["accepted", "playing_next", "played"];

type DjProfileRow = {
  id: string;
  dj_name: string;
  slug: string;
  plan: string | null;
  request_status: string;
  created_at: string;
};

type SongRequestRow = {
  dj_profile_id: string;
  request_status: string;
  dj_earnings: number | null;
  reported_not_played_at: string | null;
};

/*
 * Fetches dj_profiles and song_requests separately and joins in JS,
 * rather than relying on Supabase's automatic relationship embedding
 * (which needs a formally declared foreign key) — this repo has no
 * migration history, so that FK's existence in the live schema isn't
 * guaranteed. Aggregating in JS is fine at the current beta scale (a
 * handful of DJs); worth moving to a real SQL aggregate once request
 * volume grows enough for this to matter.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser(supabaseAuth, request);

    if (!admin) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const [djProfilesResult, songRequestsResult] = await Promise.all([
      supabaseAdmin
        .from("dj_profiles")
        .select("id, dj_name, slug, plan, request_status, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("song_requests")
        .select("dj_profile_id, request_status, dj_earnings, reported_not_played_at"),
    ]);

    if (djProfilesResult.error) {
      console.error("Admin DJs load error:", djProfilesResult.error);
      return NextResponse.json({ error: "Unable to load DJs." }, { status: 500 });
    }

    if (songRequestsResult.error) {
      console.error("Admin song requests load error:", songRequestsResult.error);
      return NextResponse.json({ error: "Unable to load DJs." }, { status: 500 });
    }

    const djProfiles = (djProfilesResult.data ?? []) as DjProfileRow[];
    const songRequests = (songRequestsResult.data ?? []) as SongRequestRow[];

    const requestsByDj = new Map<string, SongRequestRow[]>();
    for (const req of songRequests) {
      const existing = requestsByDj.get(req.dj_profile_id);
      if (existing) {
        existing.push(req);
      } else {
        requestsByDj.set(req.dj_profile_id, [req]);
      }
    }

    const djs = djProfiles.map((dj) => {
      const requests = requestsByDj.get(dj.id) ?? [];

      const acceptedEver = requests.filter((r) =>
        ACCEPTED_EVER_STATUSES.includes(r.request_status)
      ).length;

      const played = requests.filter((r) => r.request_status === "played").length;
      const notPlayedReports = requests.filter((r) => r.reported_not_played_at).length;

      const totalEarningsPence = requests.reduce(
        (sum, r) => sum + (r.dj_earnings || 0),
        0
      );

      return {
        id: dj.id,
        dj_name: dj.dj_name,
        slug: dj.slug,
        plan: dj.plan,
        request_status: dj.request_status,
        created_at: dj.created_at,
        accepted_ever: acceptedEver,
        played,
        not_played_reports: notPlayedReports,
        dispute_rate: acceptedEver > 0 ? notPlayedReports / acceptedEver : 0,
        total_earnings: totalEarningsPence / 100,
      };
    });

    return NextResponse.json({ djs });
  } catch (error) {
    console.error("Admin DJs route error:", error);
    return NextResponse.json({ error: "Unable to load DJs." }, { status: 500 });
  }
}
