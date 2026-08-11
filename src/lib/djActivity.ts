export const ACTIVITY_TIMEOUT_HOURS = 12;

/*
 * A DJ can leave request_status set to "taking_requests" indefinitely
 * (forgetting to pause after a gig) — this derives whether guests
 * should actually be able to submit right now, without ever touching
 * the DJ's own toggle. The moment they're active again, guests see
 * them as taking requests immediately; no explicit "resume" needed.
 */
export function isEffectivelyTakingRequests(profile: {
  request_status: string;
  last_active_at: string | null;
}): boolean {
  if (profile.request_status !== "taking_requests") return false;
  if (!profile.last_active_at) return false;

  const hoursSinceActive =
    (Date.now() - new Date(profile.last_active_at).getTime()) / 3_600_000;

  return hoursSinceActive < ACTIVITY_TIMEOUT_HOURS;
}
