import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/*
 * ── "They came back" ──────────────────────────────────────────────
 *
 * The first-party alternative to a tracking pixel. No open is recorded,
 * no link is rewritten, no IP address or user agent is read, and nothing
 * is sent to a provider. The only fact stored is that a DJ, signed in as
 * themselves, reached a page the email pointed at.
 *
 * Four properties, each load-bearing:
 *
 *   1. The DJ is resolved from the verified session, never from the
 *      request. There is no field here that can name a profile, so the
 *      route cannot attribute a return to anyone but the caller.
 *
 *   2. It writes only where an email was actually SENT to that DJ under
 *      that template. A marker for an email that never went out matches
 *      no row and changes nothing, so a guessed or shared URL attributes
 *      nothing.
 *
 *   3. `returned_at is null` makes it the FIRST return only. Reloading
 *      the page, or coming back next week from a bookmark, matches no
 *      row. The database enforces the same thing independently via
 *      dj_lifecycle_emails_return_is_final, because a conditional update
 *      protects the fact only while every caller remembers to write it
 *      that way.
 *
 *   4. It reports nothing back but "ok". The client does not need to
 *      know, and a response that revealed whether an email had been sent
 *      to this DJ would be a small information leak for no gain.
 *
 * Failure is silent by design. This is measurement attached to a page
 * load; a DJ trying to finish their setup must never see an error
 * because our analytics write failed.
 */

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

/** The only values the marker may take. Anything else is ignored. */
const TEMPLATES = new Set(["recovery_1", "recovery_2"]);

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(authorization.slice("Bearer ".length).trim());

  if (authError || !user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let template: unknown;

  try {
    template = (await request.json())?.template;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (typeof template !== "string" || !TEMPLATES.has(template)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from("dj_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    /* Signed in but no DJ profile. Nothing to attribute, and not an
       error worth telling anyone about. */
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin
    .from("dj_lifecycle_emails")
    .update({ returned_at: new Date().toISOString() })
    .eq("dj_profile_id", profile.id)
    .eq("template_key", template)
    .eq("status", "sent")
    .is("returned_at", null);

  if (error) {
    console.error("Lifecycle email return attribution failed:", error.message);
  }

  return NextResponse.json({ ok: true });
}
