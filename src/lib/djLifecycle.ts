/* Relative with the extension, matching backfillConnectStatus.ts: the
   "@/" alias is a bundler concept and does not resolve under plain node,
   and this module is deliberately runnable by a node harness so its
   rules can be checked against live data without a browser. */
import { isProEntitled, type PlanProfile } from "./planEntitlement.ts";

/*
 * ── Where a DJ actually is, decided in exactly one place ──────────
 *
 * Every objective stage in the funnel is derived here and stored
 * nowhere. That is the point: the CRM previously lived in a markdown
 * file where somebody had to move a DJ from "Signed up" to "Onboarded"
 * by hand, and a hand-maintained copy of something the database already
 * knows is a copy that goes stale.
 *
 * The rules below are the only definition of each stage in the product.
 * The Admin list, the funnel counts, the filters and the segments all
 * call this function rather than re-deriving anything, so there is one
 * answer to "is this DJ activated" and not four.
 *
 * Two definitions matter more than the rest and were decided
 * deliberately:
 *
 *   Activated    the DJ has accepted a first paid request and the money
 *                actually moved. Not signup, not onboarding, not
 *                connecting Stripe. Those are readiness; only this is
 *                use, and it is the difference between "14 signups" and
 *                the honest "0 activated" that reframed the whole beta.
 *
 *   Repeat user  accepted paid requests on two or more distinct local
 *                calendar dates. Dates rather than sessions, because
 *                session_started_at is cleared when a DJ pauses and one
 *                gig with a pause in it would otherwise count twice.
 *                Dates rather than events, because dj_events is empty.
 *
 * Churn is deliberately absent. With no activated DJs there is no
 * baseline for what normal usage looks like, and an invented threshold
 * would quietly move real prospects into a bucket nobody looks at.
 */

export const LIFECYCLE_STAGES = [
  "prospect",
  "signed_up",
  "onboarding_incomplete",
  "onboarded",
  "payments_ready",
  "ready_to_activate",
  "activated",
  "repeat",
  "pro",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

/** The columns of dj_profiles this module reads, and nothing more. */
export type LifecycleProfile = PlanProfile & {
  id: string;
  onboarding_complete?: boolean | null;
  /*
   * The persisted result of Connect's canReceiveEarnings, written under
   * the semantics settled in Phase 5D: transfers active and not
   * restricted. Read from the column rather than calling Stripe per DJ,
   * because an admin list of every DJ would otherwise make one Stripe
   * request each on every load - the same write-in-a-read-path smell
   * already logged against /api/stripe/connect/payouts.
   */
  stripe_connected?: boolean | null;
};

/** The columns of song_requests this module reads. */
export type LifecycleRequest = {
  request_status: string;
  /*
   * Written only on the capture path in /api/stripe/capture, so a
   * non-null value is proof that money actually moved rather than that a
   * row reached a status. This is what makes "activated" honest.
   */
  stripe_fee?: number | null;
  accepted_at?: string | null;
};

/** Statuses that mean the DJ accepted the request. */
const ACCEPTED_STATUSES = new Set([
  "accepted",
  "playing_next",
  "played",
  /* A disputed request was still accepted and still captured; the
     dispute is a later event and does not un-happen the activation. */
  "disputed",
  /* Same for a refund: it was accepted and captured first. */
  "refunded",
]);

/**
 * A request that represents real money the DJ accepted.
 *
 * Both halves are required. The status alone is not enough, because a
 * row can reach "accepted" in test data or a fixture without a capture,
 * and stripe_fee alone is not enough because a fee could in principle be
 * recorded against a request that was later declined.
 */
export function isPaidAcceptedRequest(request: LifecycleRequest): boolean {
  return (
    ACCEPTED_STATUSES.has(request.request_status) &&
    request.stripe_fee !== null &&
    request.stripe_fee !== undefined
  );
}

/**
 * Distinct local calendar dates on which the DJ accepted paid requests.
 *
 * Local rather than UTC deliberately: a gig that runs past midnight UTC
 * is still one night to the DJ, and Tonight and Earnings Today already
 * use the browser's local day. Using a different basis here would mean
 * the CRM disagreed with the dashboard about how many nights a DJ has
 * worked.
 */
export function paidGigDates(requests: LifecycleRequest[]): string[] {
  const dates = new Set<string>();

  for (const request of requests) {
    if (!isPaidAcceptedRequest(request)) continue;

    const stamp = request.accepted_at;
    if (!stamp) continue;

    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) continue;

    dates.add(
      `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    );
  }

  return [...dates];
}

export type LifecycleStats = {
  paidAcceptedCount: number;
  gigDateCount: number;
  isActivated: boolean;
  isRepeat: boolean;
  paymentsReady: boolean;
  onboarded: boolean;
  pro: boolean;
};

export function lifecycleStats(
  profile: LifecycleProfile | null,
  requests: LifecycleRequest[]
): LifecycleStats {
  const paid = requests.filter(isPaidAcceptedRequest);
  const gigDates = paidGigDates(requests);

  return {
    paidAcceptedCount: paid.length,
    gigDateCount: gigDates.length,
    isActivated: paid.length > 0,
    isRepeat: gigDates.length >= 2,
    paymentsReady: profile?.stripe_connected === true,
    onboarded: profile?.onboarding_complete === true,
    pro: isProEntitled(profile),
  };
}

/**
 * The DJ's single current stage.
 *
 * Ordered most-advanced first, so a DJ who is both Pro and activated
 * reports as Pro rather than as several things at once. The funnel
 * counts on the Admin home are deliberately built from these single
 * values, so every DJ appears in exactly one column and the numbers add
 * up to the total.
 *
 * A null profile is a prospect: somebody in the pipeline with no Playing
 * Next account yet. That is the case dj_profiles cannot represent at
 * all, and the reason crm_contacts exists.
 */
export function resolveLifecycleStage(
  profile: LifecycleProfile | null,
  requests: LifecycleRequest[] = []
): LifecycleStage {
  if (!profile) return "prospect";

  const stats = lifecycleStats(profile, requests);

  if (stats.pro) return "pro";
  if (stats.isRepeat) return "repeat";
  if (stats.isActivated) return "activated";

  if (!stats.onboarded) return "onboarding_incomplete";

  /* Onboarded and able to receive money, but no captured request yet.
     This is the group that matters most right now: everything technical
     is finished and the only thing missing is a gig. */
  if (stats.paymentsReady) return "ready_to_activate";

  return "onboarded";
}

/** Display copy. Kept beside the rules so the two cannot drift. */
export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  prospect: "Prospect",
  signed_up: "Signed up",
  onboarding_incomplete: "Onboarding incomplete",
  onboarded: "Onboarded",
  payments_ready: "Payments ready",
  ready_to_activate: "Ready to activate",
  activated: "Activated",
  repeat: "Repeat user",
  pro: "Pro",
};

/*
 * Which stages the Admin funnel strip shows, in order. Deliberately
 * seven and not nine: "signed_up" and "payments_ready" are real states
 * but never the resolved answer for anyone, because a signed-up DJ is
 * always more precisely one of the stages after it.
 */
export const FUNNEL_STAGES: LifecycleStage[] = [
  "prospect",
  "onboarding_incomplete",
  "onboarded",
  "ready_to_activate",
  "activated",
  "repeat",
  "pro",
];
