import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Which event, if any, is actually in force for a DJ right now.
 *
 * "Active" in the database is not the same question. An event row stays
 * is_active = true until somebody ends it, and Events is a Pro feature —
 * so a DJ whose subscription lapses used to keep an event silently
 * setting guest prices, stamping every new request and tip with its id,
 * and pricing checkout, while the dashboard showed them the Free upsell
 * row and put the End button behind the very gate they had just fallen
 * out of. They could not turn it off.
 *
 * The fix is a rule rather than a mutation: entitlement is checked at
 * the point of use, and without it the event is simply not in force and
 * the DJ's global defaults apply. Nothing is written, so the history is
 * untouched and comes straight back if they resubscribe.
 *
 * Every resolver goes through here. That is the point: the guest page,
 * request creation and tip creation all have to agree about which event
 * is in force, or a guest sees one price and is charged another.
 */

export type EventsEntitlementProfile = {
  plan?: string | null;
  stripe_subscription_status?: string | null;
};

/**
 * The same test the events API and the dashboard card use. A lapsed
 * payment falls back to Free everywhere at once rather than leaving
 * Events running on an unpaid subscription.
 */
export function hasEventsEntitlement(
  profile: EventsEntitlementProfile | null | undefined
): boolean {
  return (
    profile?.plan === "pro" && profile?.stripe_subscription_status === "active"
  );
}

export type ActiveEvent = {
  id: string;
  name: string;
  request_price: number | null;
  shoutout_price: number | null;
  created_at: string;
};

/**
 * The event in force for this DJ, or null.
 *
 * Null covers three different situations on purpose — no event running,
 * no Events entitlement, and the query failing — because all three mean
 * the same thing to a caller deciding what to charge: use the DJ's
 * global defaults. A caller that needs to tell them apart should read
 * the event itself.
 */
export async function resolveEffectiveEvent(
  supabase: SupabaseClient,
  profile: EventsEntitlementProfile & { id: string }
): Promise<ActiveEvent | null> {
  if (!hasEventsEntitlement(profile)) return null;

  /*
   * maybeSingle is safe because a partial unique index
   * (dj_events_one_active_per_dj_idx) guarantees at most one active row
   * per DJ. If that ever stopped holding, maybeSingle would error, the
   * error would surface here as null, and pricing would fall back to the
   * DJ's defaults — wrong, but never a charge the guest was not shown,
   * because the request page resolves through this same function and
   * the create route rejects a mismatch.
   */
  const { data, error } = await supabase
    .from("dj_events")
    .select("id, name, request_price, shoutout_price, created_at")
    .eq("dj_profile_id", profile.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Active event lookup failed:", error);
    return null;
  }

  return (data as ActiveEvent) ?? null;
}

/**
 * How long an event can have been running before it is worth asking the
 * DJ whether it is still real.
 *
 * Not enforced: an event that crosses this does NOT stop applying. A
 * price that changes underneath a DJ mid-gig because a timer expired is
 * worse than the problem it would solve, and a Friday set running into
 * Saturday morning is ordinary. It drives a prompt on the dashboard
 * instead, which is also what stops a months-old event quietly resuming
 * when a lapsed subscription is renewed: it is visibly still running,
 * and one press ends it.
 */
export const EVENT_STALE_AFTER_HOURS = 24;

export function isEventStale(
  event: { created_at: string },
  now: Date = new Date()
): boolean {
  return (
    now.getTime() - new Date(event.created_at).getTime() >
    EVENT_STALE_AFTER_HOURS * 3_600_000
  );
}
