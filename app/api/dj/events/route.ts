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

async function loadDjProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("dj_profiles")
    .select("id, plan, stripe_subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

function isPro(profile: { plan?: string | null; stripe_subscription_status?: string | null }) {
  return profile.plan === "pro" && profile.stripe_subscription_status === "active";
}

/*
 * Lists this DJ's events, most recent first, each with a summed
 * earnings/request-count snapshot. Two extra queries per event rather
 * than a join — this list is short (a DJ isn't running hundreds of
 * events) and it keeps the aggregation simple to read.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json(
        { error: "Your session is invalid or has expired." },
        { status: 401 }
      );
    }

    const profile = await loadDjProfile(user.id);

    if (!profile) {
      return NextResponse.json(
        { error: "DJ profile could not be found." },
        { status: 404 }
      );
    }

    const { data: events, error: eventsError } = await supabaseAdmin
      .from("dj_events")
      .select("id, name, request_price, shoutout_price, is_active, created_at, ended_at")
      .eq("dj_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (eventsError) {
      console.error("Events load error:", eventsError);

      return NextResponse.json(
        { error: "Unable to load events." },
        { status: 500 }
      );
    }

    const withSummaries = await Promise.all(
      (events ?? []).map(async (event) => {
        const { data: requests } = await supabaseAdmin
          .from("song_requests")
          .select("dj_earnings")
          .eq("event_id", event.id)
          .in("request_status", ["accepted", "playing_next", "played"]);

        const { data: tips } = await supabaseAdmin
          .from("tips")
          .select("dj_earnings")
          .eq("event_id", event.id)
          .eq("status", "succeeded");

        const requestEarnings = (requests ?? []).reduce(
          (sum, row) => sum + (row.dj_earnings ?? 0),
          0
        );
        const tipEarnings = (tips ?? []).reduce(
          (sum, row) => sum + (row.dj_earnings ?? 0),
          0
        );

        return {
          ...event,
          requestCount: requests?.length ?? 0,
          totalEarnings: requestEarnings + tipEarnings,
        };
      })
    );

    return NextResponse.json({ events: withSummaries, isPro: isPro(profile) });
  } catch (error) {
    console.error("Events route error:", error);

    return NextResponse.json(
      { error: "Unable to load events." },
      { status: 500 }
    );
  }
}

/*
 * Creating an event does not make it active — that's a separate step
 * via /api/dj/events/activate, so a DJ can set one up in advance
 * without disrupting whatever they're currently running.
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

    const profile = await loadDjProfile(user.id);

    if (!profile) {
      return NextResponse.json(
        { error: "DJ profile could not be found." },
        { status: 404 }
      );
    }

    if (!isPro(profile)) {
      return NextResponse.json(
        { error: "Events are a Pro feature." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
    const requestPrice =
      typeof body.requestPrice === "number" && Number.isInteger(body.requestPrice)
        ? body.requestPrice
        : null;
    const shoutoutPrice =
      typeof body.shoutoutPrice === "number" && Number.isInteger(body.shoutoutPrice)
        ? body.shoutoutPrice
        : null;

    if (!name) {
      return NextResponse.json(
        { error: "Please give this event a name." },
        { status: 400 }
      );
    }

    if ((requestPrice !== null && requestPrice <= 0) || (shoutoutPrice !== null && shoutoutPrice <= 0)) {
      return NextResponse.json(
        { error: "Custom prices must be greater than zero." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("dj_events")
      .insert({
        dj_profile_id: profile.id,
        name,
        request_price: requestPrice,
        shoutout_price: shoutoutPrice,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Event create error:", error);

      return NextResponse.json(
        { error: "Unable to create event." },
        { status: 500 }
      );
    }

    return NextResponse.json({ eventId: data.id });
  } catch (error) {
    console.error("Events create route error:", error);

    return NextResponse.json(
      { error: "Unable to create event." },
      { status: 500 }
    );
  }
}
