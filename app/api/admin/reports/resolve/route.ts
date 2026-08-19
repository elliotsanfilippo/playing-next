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

const RESOLUTIONS = ["refunded", "denied"];

/*
 * Records the outcome of a manual investigation only — it does not
 * touch Stripe. Actually issuing a refund or holding a payout is a
 * separate, deliberately unbuilt piece (see item 2 in the product
 * notes): for now this is just the audit trail of what was decided.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser(supabaseAuth, request);

    if (!admin) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const body = await request.json();
    const reportId = typeof body.reportId === "string" ? body.reportId : "";
    const resolution = typeof body.resolution === "string" ? body.resolution : "";

    if (!reportId || !RESOLUTIONS.includes(resolution)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("not_played_reports")
      .update({ resolution, resolved_at: new Date().toISOString() })
      .eq("id", reportId)
      .eq("resolution", "pending");

    if (error) {
      console.error("Admin report resolve error:", error);
      return NextResponse.json({ error: "Unable to update this report." }, { status: 500 });
    }

    return NextResponse.json({ resolved: true });
  } catch (error) {
    console.error("Admin report resolve route error:", error);
    return NextResponse.json({ error: "Unable to update this report." }, { status: 500 });
  }
}
