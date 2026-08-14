import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function authenticate(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return user;
}

/*
 * Switches which event new requests/tips get tagged with. A DJ only
 * ever has one active event (enforced by a partial unique index), so
 * switching to a new one — or clearing back to "no event" — first
 * deactivates whatever was active and stamps its ended_at, then
 * activates the new one. eventId: null just ends the current event
 * with nothing replacing it.
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
      .select("id, plan, stripe_subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "DJ profile could not be found." },
        { status: 404 }
      );
    }

    if (!(profile.plan === "pro" && profile.stripe_subscription_status === "active")) {
      return NextResponse.json(
        { error: "Events are a Pro feature." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : null;

    if (eventId) {
      const { data: targetEvent, error: targetError } = await supabaseAdmin
        .from("dj_events")
        .select("id, dj_profile_id")
        .eq("id", eventId)
        .maybeSingle();

      if (targetError || !targetEvent || targetEvent.dj_profile_id !== profile.id) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }
    }

    await supabaseAdmin
      .from("dj_events")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq("dj_profile_id", profile.id)
      .eq("is_active", true);

    if (eventId) {
      const { error: activateError } = await supabaseAdmin
        .from("dj_events")
        .update({ is_active: true, ended_at: null })
        .eq("id", eventId);

      if (activateError) {
        console.error("Event activate error:", activateError);

        return NextResponse.json(
          { error: "Unable to activate event." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Event activate route error:", error);

    return NextResponse.json(
      { error: "Unable to update event." },
      { status: 500 }
    );
  }
}
