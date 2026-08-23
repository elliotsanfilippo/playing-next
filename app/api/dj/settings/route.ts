import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateSettings } from "@/src/lib/settingsValidation";

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

async function authenticate(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) return null;

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(authorization.slice("Bearer ".length).trim());

  return error || !user ? null : user;
}

/*
 * The authority on what a DJ may configure.
 *
 * Settings used to update dj_profiles straight from the browser, which
 * made every pricing and capacity rule advisory: the checks lived in the
 * page, so anything that did not go through the page did not get
 * checked. A price outside the allowed range would then surface as a
 * failed checkout in front of a paying guest rather than as an error at
 * save time.
 *
 * Two things make this route safe rather than just tidier:
 *
 *   1. Ownership comes from the session, never from the request body.
 *      The profile is resolved by the authenticated user's id and the
 *      UPDATE is keyed on that, so there is no id a caller could send to
 *      write someone else's row. The service-role client is only ever
 *      pointed at a row the token already proved ownership of.
 *
 *   2. The column list is an allowlist written out below. A body
 *      carrying plan, stripe_account_id or slug cannot reach the
 *      database, because nothing here reads those keys.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json(
        { error: "Your session is invalid or has expired." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("dj_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "DJ profile could not be found." },
        { status: 404 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Settings could not be read." },
        { status: 400 }
      );
    }

    const result = validateSettings(body);

    /*
     * All or nothing. A settings save that applies the valid half and
     * reports the rest is worse than one that refuses: the DJ walks away
     * believing they fixed something they did not.
     */
    if (!result.ok) {
      return NextResponse.json(
        { error: "Some settings need fixing.", errors: result.errors },
        { status: 400 }
      );
    }

    const value = result.value;

    const { data: saved, error: updateError } = await supabaseAdmin
      .from("dj_profiles")
      .update({
        dj_name: value.djName,
        genres: value.genres,
        bio: value.bio,
        request_price: value.requestPrice,
        shoutout_price: value.messagePrice,
        max_pending_requests: value.maxPending,
        max_queue_requests: value.maxQueue,
        /* Stored inverted from how it is shown. The column is a
         * negative; the switch is a positive. */
        hidden_from_discovery: !value.showInDiscovery,
      })
      .eq("id", profile.id)
      .select(
        "dj_name, genres, bio, request_price, shoutout_price, max_pending_requests, max_queue_requests, hidden_from_discovery"
      )
      .single();

    if (updateError || !saved) {
      console.error("Settings save error:", updateError);

      return NextResponse.json(
        { error: "Your settings couldn't be saved. Nothing has changed." },
        { status: 500 }
      );
    }

    /*
     * The saved row goes back so the page can re-seed itself from what
     * the database actually holds, rather than assuming its own form
     * state won and refetching the whole page into a loading screen.
     */
    return NextResponse.json({ settings: saved });
  } catch (error) {
    console.error("Settings route error:", error);

    return NextResponse.json(
      { error: "Your settings couldn't be saved. Nothing has changed." },
      { status: 500 }
    );
  }
}
