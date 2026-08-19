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

type ReportRow = {
  id: string;
  reason: string | null;
  resolution: string;
  created_at: string;
  resolved_at: string | null;
  song_request_id: string;
  dj_profile_id: string;
};

/*
 * Fetches not_played_reports, song_requests and dj_profiles separately
 * and joins in JS, rather than relying on Supabase's automatic
 * relationship embedding (which needs formally declared foreign keys)
 * — this repo has no migration history, so those FKs' existence in the
 * live schema isn't guaranteed.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser(supabaseAuth, request);

    if (!admin) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const { data: reportsData, error } = await supabaseAdmin
      .from("not_played_reports")
      .select("id, reason, resolution, created_at, resolved_at, song_request_id, dj_profile_id")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin reports load error:", error);
      return NextResponse.json({ error: "Unable to load reports." }, { status: 500 });
    }

    const reports = (reportsData ?? []) as ReportRow[];

    const songRequestIds = [...new Set(reports.map((r) => r.song_request_id))];
    const djProfileIds = [...new Set(reports.map((r) => r.dj_profile_id))];

    const [songRequestsResult, djProfilesResult] = await Promise.all([
      songRequestIds.length > 0
        ? supabaseAdmin
            .from("song_requests")
            .select("id, song_title, artist")
            .in("id", songRequestIds)
        : Promise.resolve({ data: [], error: null }),
      djProfileIds.length > 0
        ? supabaseAdmin.from("dj_profiles").select("id, dj_name, slug").in("id", djProfileIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (songRequestsResult.error || djProfilesResult.error) {
      console.error(
        "Admin reports join load error:",
        songRequestsResult.error || djProfilesResult.error
      );
      return NextResponse.json({ error: "Unable to load reports." }, { status: 500 });
    }

    const songMap = new Map(
      (songRequestsResult.data ?? []).map((s) => [s.id, s])
    );
    const djMap = new Map((djProfilesResult.data ?? []).map((d) => [d.id, d]));

    const enrichedReports = reports.map((report) => ({
      id: report.id,
      reason: report.reason,
      resolution: report.resolution,
      created_at: report.created_at,
      resolved_at: report.resolved_at,
      song_requests: songMap.get(report.song_request_id) ?? null,
      dj_profiles: djMap.get(report.dj_profile_id) ?? null,
    }));

    return NextResponse.json({ reports: enrichedReports });
  } catch (error) {
    console.error("Admin reports route error:", error);
    return NextResponse.json({ error: "Unable to load reports." }, { status: 500 });
  }
}
