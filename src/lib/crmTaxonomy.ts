/*
 * ── The CRM's vocabulary, in one place ────────────────────────────
 *
 * These lists are mirrored by CHECK constraints in
 * supabase/migrations/20260828_crm_contacts.sql. Postgres is the real
 * enforcement; this module exists so the UI offers exactly the values
 * the database will accept, and so an API route can reject a bad one
 * with a readable message instead of surfacing a raw 23514.
 *
 * Change one and you must change the other. There is no migration that
 * reads this file.
 */

export const OUTREACH_STATUSES = [
  "prospect",
  "contacted",
  "interested",
  "signing_up",
  "signed_up",
  "not_interested",
  "lost",
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

/*
 * ── The relationship states worth maintaining by hand ─────────────
 *
 * The list above is what Postgres accepts and must stay complete. This
 * one is what the interface offers, and it is deliberately shorter.
 *
 * "signed_up" is gone from it because it was never a human judgement.
 * Measured on 2026-08-30: all seven linked contacts held it and nobody
 * else did, so the field said nothing at all about anyone with an
 * account. Whether somebody signed up is product truth,
 * answered by dj_profile_id and by the lifecycle resolver, and asking a
 * person to maintain a second copy of it is asking them to keep a copy
 * that goes stale.
 *
 * "lost" is gone because nothing ever distinguished it from
 * "not_interested" - it was never used on a single row, and a value
 * that has to be explained before it can be chosen is a value that will
 * be chosen inconsistently.
 *
 * Neither is dropped from the database and no row is rewritten. Both
 * remain valid values Postgres accepts, existing rows keep them, and
 * the select still renders a stored one so that opening a contact and
 * saving cannot silently change it. This mirrors how next_action and
 * next_follow_up_at were retired: stop reading and writing, leave the
 * data alone, decide about the column separately.
 */
export const OUTREACH_OFFERED = [
  "prospect",
  "contacted",
  "interested",
  "signing_up",
  "not_interested",
] as const;

/*
 * Phrased as the state you are in rather than the act that got you
 * there, because the question the field answers is "where does this
 * relationship stand", and "Contacted" alone never said whether you
 * were still waiting.
 */
export const OUTREACH_LABELS: Record<OutreachStatus, string> = {
  prospect: "Not contacted",
  contacted: "Contacted, awaiting reply",
  interested: "Interested",
  signing_up: "Signing up",
  signed_up: "Signed up (set automatically)",
  not_interested: "Not interested",
  lost: "Lost",
};

/*
 * Why a DJ who is technically ready has not taken a first paid request.
 *
 * This taxonomy came out of real conversations rather than being
 * invented up front, which is why "venue_refused" and
 * "believes_permission_required" are separate: Cammy Birse's blocker is
 * that the venue said no, which is a commercial problem, while a DJ who
 * assumes they need permission and never asks is a messaging problem.
 * Collapsing them would hide the difference between the two fixes.
 */
export const ACTIVATION_BLOCKERS = [
  "ready_not_attempted",
  "venue_refused",
  "believes_permission_required",
  "no_suitable_gig",
  "product_or_setup",
  "dj_not_interested",
  "unknown_awaiting_response",
] as const;

export type ActivationBlocker = (typeof ACTIVATION_BLOCKERS)[number];

export const BLOCKER_LABELS: Record<ActivationBlocker, string> = {
  ready_not_attempted: "Ready, not yet attempted",
  venue_refused: "Venue refused",
  believes_permission_required: "Believes permission needed",
  no_suitable_gig: "No suitable gig",
  product_or_setup: "Product or setup problem",
  dj_not_interested: "DJ not interested",
  unknown_awaiting_response: "Unknown, awaiting reply",
};

/* Suggested rather than constrained: the column is free text on purpose,
   because this list will grow and a migration per new channel would be
   absurd. MANUAL ONLY - measured attribution never writes here. */
export const ACQUISITION_SOURCES = [
  "Direct outreach",
  "Instagram",
  "Referral",
  "Organic",
  "Other",
];

export function isOutreachStatus(value: unknown): value is OutreachStatus {
  return OUTREACH_STATUSES.includes(value as OutreachStatus);
}

export function isActivationBlocker(value: unknown): value is ActivationBlocker {
  return ACTIVATION_BLOCKERS.includes(value as ActivationBlocker);
}

/*
 * ── Whether a recorded blocker still needs you ────────────────────
 *
 * The queue used to treat any non-null activation_blocker as "handled",
 * which is how importing the real pipeline made the four most important
 * DJs vanish from Needs You the moment their outreach was recorded.
 * "Unknown, awaiting reply" is not a resolved state; it is the state of
 * waiting on someone, which is precisely when you need reminding.
 *
 * So a blocker carries a policy rather than a presence:
 *
 *   always      the ball is in our court, or nobody has tried yet.
 *               Surfaces until the blocker changes.
 *
 *   when_due    the ball is in their court and there is nothing to do
 *               unless you have written down what to do next, or set a
 *               date. Cammy is the case this exists for: venue refused,
 *               but the next action is asking about his other sets, so
 *               he stays visible - while a venue refusal with nothing
 *               recorded against it does not nag forever.
 *
 *   only_date   the relationship is closed. It comes back only if you
 *               deliberately schedule a follow-up.
 */
export type BlockerPolicy = "always" | "when_due" | "only_date";

export const BLOCKER_POLICY: Record<ActivationBlocker, BlockerPolicy> = {
  unknown_awaiting_response: "always",
  ready_not_attempted: "always",
  product_or_setup: "always",
  no_suitable_gig: "when_due",
  believes_permission_required: "when_due",
  venue_refused: "when_due",
  dj_not_interested: "only_date",
};

export function blockerPolicy(value: string | null | undefined): BlockerPolicy {
  if (!value) return "always";
  return isActivationBlocker(value) ? BLOCKER_POLICY[value] : "always";
}
