import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin, serverError } from "@/src/lib/adminApi";

/*
 * ── Candidates for linking a prospect to a real account ───────────
 *
 * Returns only DJ profiles no contact has claimed yet. The exclusion is
 * done here rather than in the browser so the list a person picks from
 * cannot contain a choice that is guaranteed to fail, and so the UNIQUE
 * constraint on crm_contacts.dj_profile_id is a backstop rather than
 * the first thing the admin hears about.
 *
 * Deliberately no fuzzy matching and no scoring. Linking a person to an
 * account is a claim about identity, and the whole point of the
 * accompanying UI is that a human makes it explicitly.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const [profilesResult, contactsResult] = await Promise.all([
      supabaseAdmin
        .from("dj_profiles")
        .select("id, dj_name, slug, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("crm_contacts")
        .select("dj_profile_id")
        .not("dj_profile_id", "is", null),
    ]);

    if (profilesResult.error) {
      return serverError("Unlinked DJs load error:", profilesResult.error);
    }
    if (contactsResult.error) {
      return serverError("Unlinked DJs claim load error:", contactsResult.error);
    }

    const claimed = new Set(
      (contactsResult.data ?? []).map((c) => c.dj_profile_id as string)
    );

    const djs = (profilesResult.data ?? [])
      .filter((p) => !claimed.has(p.id))
      .map((p) => ({
        id: p.id,
        dj_name: p.dj_name,
        slug: p.slug,
        created_at: p.created_at,
      }));

    return NextResponse.json({ djs });
  } catch (error) {
    return serverError("Unlinked DJs route error:", error);
  }
}
