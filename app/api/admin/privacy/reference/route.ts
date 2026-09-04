import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin, serverError } from "@/src/lib/adminApi";

/*
 * ── The next privacy-request reference ────────────────────────────
 *
 * Suggests PR-YYYY-NNN. It does not allocate one: no counter, no
 * sequence table, and the admin confirms the number they actually use.
 *
 * It reads BOTH audit tables, because the series is shared. A reference
 * identifies a request, not a table, and an erasure and an access
 * request must never be able to collide on one. Refusals count too: a
 * refused request consumed its number, and the process is auditable
 * either way.
 *
 * GET only, so it cannot mutate anything whatever verb arrives.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const year = new Date().getUTCFullYear();
  const prefix = `PR-${year}-`;

  try {
    const [erasures, access] = await Promise.all([
      supabaseAdmin
        .from("data_erasures")
        .select("request_reference")
        .like("request_reference", `${prefix}%`),
      supabaseAdmin
        .from("data_access_requests")
        .select("request_reference")
        .like("request_reference", `${prefix}%`),
    ]);

    if (erasures.error) return serverError("Next reference: erasures error:", erasures.error);
    if (access.error) return serverError("Next reference: access error:", access.error);

    const used = [...(erasures.data ?? []), ...(access.data ?? [])]
      .map((r) => r.request_reference as string | null)
      .filter((r): r is string => !!r)
      .map((r) => Number.parseInt(r.slice(prefix.length), 10))
      .filter((n) => Number.isFinite(n));

    const highest = used.length ? Math.max(...used) : 0;

    return NextResponse.json({
      suggestion: `${prefix}${String(highest + 1).padStart(3, "0")}`,
      highestUsed: highest ? `${prefix}${String(highest).padStart(3, "0")}` : null,
      year,
    });
  } catch (error) {
    return serverError("Next reference route error:", error);
  }
}
