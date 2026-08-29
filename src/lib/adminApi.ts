import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/src/lib/adminAuth";

/*
 * ── The only way CRM data is allowed to be reached ────────────────
 *
 * crm_contacts and crm_notes have RLS on with no policies and explicit
 * revokes from anon and authenticated, verified against production on
 * 2026-08-29: all eight verb/table combinations return 42501 for both
 * roles, including a real logged-in DJ session. The service-role client
 * below is therefore the entire access path, and getAdminUser is the
 * entire authorisation for it.
 *
 * Which means: never reach for `supabase` (the browser client) in an
 * admin route. If that mistake is made the database refuses it rather
 * than quietly returning nothing, but it should not be made.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/*
 * Returns a 403 response when the caller is not an admin, or null when
 * they are. Callers write `const denied = await requireAdmin(request);
 * if (denied) return denied;` so the guard cannot be accidentally
 * written as a truthy check on a user object that might be null.
 *
 * 403 with a flat message, matching the existing admin routes: the page
 * shell renders the site's ordinary 404 on a 403 so that stumbling onto
 * /admin does not confirm an admin area exists.
 */
export async function requireAdmin(
  request: NextRequest
): Promise<NextResponse | null> {
  const admin = await getAdminUser(supabaseAuth, request);
  if (!admin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  return null;
}

/** Consistent shape for the failures the CRM UI has to tell apart. */
export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(context: string, error: unknown) {
  console.error(context, error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
