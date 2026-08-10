import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";
import { QR_BOX_LIMIT } from "@/src/lib/pricing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/*
 * Public and unauthenticated — the Settings page needs to know whether
 * to show the "first 50" teaser before a DJ has even upgraded, let
 * alone signed anything that would scope a read. Only ever returns a
 * boolean, never a count or any DJ data.
 */
export async function GET(request: NextRequest) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `qr-box-availability:${getClientIp(request)}`,
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

    const { count, error } = await supabase
      .from("dj_profiles")
      .select("id", { count: "exact", head: true })
      .eq("qr_box_eligible", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      available: (count ?? 0) < QR_BOX_LIMIT,
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
