export const ACTIVITY_TIMEOUT_HOURS = 12;

/*
 * A DJ can leave request_status set to "taking_requests" indefinitely
 * (forgetting to pause after a gig) — this derives whether guests
 * should actually be able to submit right now, without ever touching
 * the DJ's own toggle. The moment they're active again, guests see
 * them as taking requests immediately; no explicit "resume" needed.
 *
 * auto_close_at is the DJ-scheduled counterpart: an optional, much
 * shorter deadline they set themselves (e.g. "close at 2am") rather
 * than the 12h safety-net default. Same shape — checked live here,
 * never written back — so a DJ who reopens manually after it passes
 * just needs their next toggle click to clear it (handled where the
 * toggle lives, not here).
 */
export function isEffectivelyTakingRequests(profile: {
  request_status: string;
  last_active_at: string | null;
  auto_close_at?: string | null;
}): boolean {
  if (profile.request_status !== "taking_requests") return false;
  if (!profile.last_active_at) return false;

  const hoursSinceActive =
    (Date.now() - new Date(profile.last_active_at).getTime()) / 3_600_000;

  if (hoursSinceActive >= ACTIVITY_TIMEOUT_HOURS) return false;

  if (profile.auto_close_at && new Date(profile.auto_close_at) <= new Date()) {
    return false;
  }

  return true;
}
