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

export const OUTREACH_LABELS: Record<OutreachStatus, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  interested: "Interested",
  signing_up: "Signing up",
  signed_up: "Signed up",
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
