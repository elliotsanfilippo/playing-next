import { createClient } from "@supabase/supabase-js";

/*
 * ── The public bootstrap boundary ─────────────────────────────────
 *
 * What the guest request page is allowed to know about a DJ before it
 * has run any JavaScript, and nothing else.
 *
 * This module is deliberately paranoid, because the last time this page
 * changed what it read from dj_profiles it took every DJ's request page
 * down. Three things keep it honest:
 *
 *   1. It reads public.public_dj_request_bootstrap, never dj_profiles.
 *      That view's select list is the security boundary and it lives in
 *      a migration, so a new column on dj_profiles is private until
 *      somebody deliberately publishes it.
 *
 *   2. It uses the ANON key, not the service role. The server has no
 *      more privilege here than the guest's browser does, so there is no
 *      escalation to get wrong.
 *
 *   3. The DTO below is built field by field. There is no spread, no
 *      rest, and no returning of the row. A column that appears in the
 *      view without being named here never reaches the browser.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/*
 * Its own client rather than the shared browser one: that instance
 * persists an auth session, which on the server would be shared across
 * every request the process handles. This one is stateless.
 */
const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/*
 * The columns the server asks the view for.
 *
 * bio is deliberately absent. The view exposes it so the client's
 * reconciliation fetch has a home for it, but a biography sits behind a
 * disclosure below the fold and does not belong in the first paint —
 * has_bio is all the server needs to decide whether the disclosure
 * should render at all.
 */
const BOOTSTRAP_SELECT =
  "id, dj_name, profile_image_url, genres, has_bio, " +
  "request_status, last_active_at, auto_close_at, " +
  "effective_request_price, effective_shoutout_price, " +
  "effective_event_id, effective_event_name";

export type PublicDjRequestBootstrap = {
  id: string;
  djName: string;
  profileImageUrl: string | null;
  genres: string[] | null;
  hasBio: boolean;
  requestStatus: string;
  lastActiveAt: string | null;
  autoCloseAt: string | null;
  effectiveRequestPrice: number;
  effectiveShoutoutPrice: number;
  effectiveEvent: { id: string; name: string } | null;
};

/*
 * Three outcomes, not two.
 *
 * The bug this replaces collapsed "no such DJ" and "the query failed"
 * into a single null, and the page rendered "DJ Not Found" for both. On
 * 2026-09-03 that meant every working DJ's page told their guests the DJ
 * did not exist, because one column in the select was not readable. A
 * failure to load is not evidence of absence and must never be rendered
 * as one.
 */
export type BootstrapResult =
  | { status: "ok"; dj: PublicDjRequestBootstrap }
  | { status: "not_found" }
  | { status: "error"; reason: string };

/*
 * The allowlist, written out. Every field is assigned by hand from a
 * named column. Nothing is copied wholesale, so this function cannot
 * start leaking a column just because the view grew one.
 */
function toPublicDto(row: Record<string, unknown>): PublicDjRequestBootstrap {
  const eventId = row.effective_event_id;
  const eventName = row.effective_event_name;

  return {
    id: String(row.id),
    djName: String(row.dj_name ?? ""),
    profileImageUrl:
      typeof row.profile_image_url === "string" && row.profile_image_url
        ? row.profile_image_url
        : null,
    genres: Array.isArray(row.genres) ? (row.genres as string[]) : null,
    hasBio: row.has_bio === true,
    requestStatus: String(row.request_status ?? ""),
    lastActiveAt:
      typeof row.last_active_at === "string" ? row.last_active_at : null,
    autoCloseAt:
      typeof row.auto_close_at === "string" ? row.auto_close_at : null,
    effectiveRequestPrice: Number(row.effective_request_price ?? 0),
    effectiveShoutoutPrice: Number(row.effective_shoutout_price ?? 0),
    effectiveEvent:
      typeof eventId === "string" && eventId
        ? { id: eventId, name: String(eventName ?? "") }
        : null,
  };
}

export async function fetchPublicDjBootstrap(
  slug: string
): Promise<BootstrapResult> {
  try {
    const { data, error } = await publicClient
      .from("public_dj_request_bootstrap")
      .select(BOOTSTRAP_SELECT)
      .eq("slug", slug)
      .maybeSingle();

    /* An error is an error. It is never treated as absence — see
       BootstrapResult above for why that distinction is load-bearing. */
    if (error) return { status: "error", reason: error.message };

    if (!data) return { status: "not_found" };

    return {
      status: "ok",
      dj: toPublicDto(data as unknown as Record<string, unknown>),
    };
  } catch (cause) {
    /* Network failure, DNS, a timeout: still not absence. */
    return {
      status: "error",
      reason: cause instanceof Error ? cause.message : "unknown",
    };
  }
}

/*
 * Exported so the security test can assert on the exact shape the server
 * is allowed to serialize, without having to reach into a React tree.
 */
export const PUBLIC_BOOTSTRAP_FIELDS = [
  "id",
  "djName",
  "profileImageUrl",
  "genres",
  "hasBio",
  "requestStatus",
  "lastActiveAt",
  "autoCloseAt",
  "effectiveRequestPrice",
  "effectiveShoutoutPrice",
  "effectiveEvent",
] as const;
