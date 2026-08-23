import { NextRequest, NextResponse } from "next/server";
import { validateEvent } from "@/src/lib/eventValidation";
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
    /* The DJ's own prices come along because event validation compares
       effective prices, not just the submitted overrides. */
    .select("id, plan, stripe_subscription_status, request_price, shoutout_price")
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

    /*
     * Two queries for the whole list rather than two per event.
     *
     * This used to run a requests query and a tips query inside a map,
     * so fifty events meant a hundred and one round trips to build one
     * card. Both are fetched once, scoped to the ids on screen, and
     * totalled in memory.
     *
     * The earnings definition is deliberately identical to the earnings
     * page: stored dj_earnings snapshots, the same three earning
     * statuses, and succeeded tips only. Historical economics are never
     * recomputed from today's prices.
     */
    const eventIds = (events ?? []).map((event) => event.id);

    const [{ data: requestRows }, { data: tipRows }] = await Promise.all([
      eventIds.length
        ? supabaseAdmin
            .from("song_requests")
            .select("event_id, dj_earnings")
            .in("event_id", eventIds)
            .in("request_status", ["accepted", "playing_next", "played"])
        : Promise.resolve({ data: [] as { event_id: string; dj_earnings: number | null }[] }),
      eventIds.length
        ? supabaseAdmin
            .from("tips")
            .select("event_id, dj_earnings")
            .in("event_id", eventIds)
            .eq("status", "succeeded")
        : Promise.resolve({ data: [] as { event_id: string; dj_earnings: number | null }[] }),
    ]);

    const requestCounts = new Map<string, number>();
    const earnings = new Map<string, number>();

    for (const row of (requestRows ?? []) as { event_id: string; dj_earnings: number | null }[]) {
      requestCounts.set(row.event_id, (requestCounts.get(row.event_id) ?? 0) + 1);
      earnings.set(row.event_id, (earnings.get(row.event_id) ?? 0) + (row.dj_earnings ?? 0));
    }

    /* Tips count towards the event's earnings but never towards its
       request count: a tip is its own thing, not a request. */
    for (const row of (tipRows ?? []) as { event_id: string; dj_earnings: number | null }[]) {
      earnings.set(row.event_id, (earnings.get(row.event_id) ?? 0) + (row.dj_earnings ?? 0));
    }

    const withSummaries = (events ?? []).map((event) => ({
      ...event,
      requestCount: requestCounts.get(event.id) ?? 0,
      totalEarnings: earnings.get(event.id) ?? 0,
    }));

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

    /*
     * The same rules Settings enforces, applied through the same
     * limits. Events used to accept any integer above zero, so an event
     * could charge 1p, or £10,000, or price Song + Message below a
     * standard request — a guest paying less for the strictly larger
     * product. Names were sliced to 100 characters and came back
     * silently shortened; they are rejected with a reason now.
     *
     * The DJ's own defaults are passed in because the "Song + Message
     * costs more" rule is about what a guest is charged. An event
     * overriding only the request price could otherwise break it while
     * every submitted field looked individually fine.
     */
    const result = validateEvent(body, {
      requestPrice: profile.request_price ?? 0,
      messagePrice: profile.shoutout_price ?? 0,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Some event details need fixing.", errors: result.errors },
        { status: 400 }
      );
    }

    const { name, requestPrice, messagePrice } = result.value;

    const { data, error } = await supabaseAdmin
      .from("dj_events")
      .insert({
        dj_profile_id: profile.id,
        name,
        request_price: requestPrice,
        shoutout_price: messagePrice,
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

/*
 * Edit an event's name or price overrides.
 *
 * Before this, an event could not be changed at all — no PATCH existed —
 * so fixing a typo in a name or a wrong price mid-gig meant ending the
 * event and starting another, splitting one night across two rows.
 *
 * Edits affect new requests only, and that is structural rather than a
 * promise: every request stores its own financial snapshot at checkout
 * (request_amount, dj_earnings, platform_fee, plan_at_checkout,
 * pricing_version) and nothing recomputes them. Changing this row cannot
 * reach a request that has already been priced.
 */
export async function PATCH(request: NextRequest) {
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
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";

    if (!eventId) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    /*
     * Ownership is proved against the authenticated profile before
     * anything is written, and the UPDATE is keyed on both the event id
     * and the profile id — so even a mistake here could not reach
     * another DJ's row.
     */
    const { data: existing } = await supabaseAdmin
      .from("dj_events")
      .select("id, dj_profile_id")
      .eq("id", eventId)
      .maybeSingle();

    if (!existing || existing.dj_profile_id !== profile.id) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const result = validateEvent(body, {
      requestPrice: profile.request_price ?? 0,
      messagePrice: profile.shoutout_price ?? 0,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Some event details need fixing.", errors: result.errors },
        { status: 400 }
      );
    }

    /* An allowlist, written out. is_active, ended_at, dj_profile_id and
       created_at are not editable through this route at any price. */
    const { error: updateError } = await supabaseAdmin
      .from("dj_events")
      .update({
        name: result.value.name,
        request_price: result.value.requestPrice,
        shoutout_price: result.value.messagePrice,
      })
      .eq("id", eventId)
      .eq("dj_profile_id", profile.id);

    if (updateError) {
      console.error("Event update error:", updateError);

      return NextResponse.json(
        { error: "Unable to save this event." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Events patch route error:", error);

    return NextResponse.json(
      { error: "Unable to save this event." },
      { status: 500 }
    );
  }
}
