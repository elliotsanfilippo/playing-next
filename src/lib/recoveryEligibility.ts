/* Relative imports with the extension, matching djLifecycle.ts: this
   module is deliberately runnable by a plain node harness so its rules
   can be checked without a browser or a bundler. */
import { isInternalDj } from "./internalAccounts.ts";
import { isPaidAcceptedRequest, type LifecycleRequest } from "./djLifecycle.ts";

/*
 * ── Who gets an onboarding-recovery email, and which one ──────────
 *
 * Pure. No I/O, no database, no clock of its own: the caller passes
 * `now` so the whole thing is testable and so two DJs evaluated in the
 * same run are judged against the same instant.
 *
 * Everything here is derived from real product state. Nothing reads
 * crm_contacts, outreach_status, a task, or a note. A hand-maintained
 * CRM field deciding who receives an automated email is the exact
 * failure the Admin CRM was built to remove, and it would be worse here
 * than on a screen, because a wrong row in a list is a wrong email in
 * somebody's inbox.
 */

export type RecoveryState = "A" | "B" | "C" | "ready";
export type RecoveryTemplate = "recovery_1" | "recovery_2";

/** Days after account creation. Approved 2026-09-02. */
export const R1_DAY = 3;
export const R2_DAY = 10;
/** R2 never lands within this many days of R1, whatever the ages say. */
export const R2_MIN_GAP_DAYS = 6;
/** A known failure is retried at most this many times in total. */
export const MAX_EMAIL_ATTEMPTS = 3;

export type RecoveryProfile = {
  id: string;
  slug: string | null;
  dj_name: string | null;
  request_price: number | null;
  profile_image_url: string | null;
  stripe_connected: boolean | null;
  stripe_account_id: string | null;
  lifecycle_emails_opted_out?: boolean | null;
  created_at: string;
};

/** The placeholder written by bootstrap-profile at signup. */
const PLACEHOLDER_NAME = "New DJ";

/*
 * The four profile facts that make a page usable by a guest.
 *
 * This mirrors the five-condition check in app/dj/dashboard/page.tsx and
 * the step list in app/dj/dashboard/components/Onboarding.tsx, minus the
 * Stripe condition, which is deliberately separate here.
 *
 * That separation is the whole reason this module exists. The stored
 * `onboarding_complete` flag INCLUDES stripe_connected, so it cannot
 * express "profile finished, payouts missing" at all, and
 * resolveLifecycleStage returns the same onboarding_incomplete for a DJ
 * who has done nothing and a DJ who has done everything but their name.
 * Those two people need different emails.
 *
 * Known duplication, recorded rather than hidden: the dashboard computes
 * its version inline. Migrating it to call this belongs with the next
 * piece of dashboard work, not with an email change.
 */
export function profileComplete(profile: RecoveryProfile): boolean {
  return (
    Boolean(profile.dj_name) &&
    profile.dj_name !== PLACEHOLDER_NAME &&
    (profile.request_price ?? 0) > 0 &&
    Boolean(profile.profile_image_url) &&
    Boolean(profile.slug)
  );
}

export function payoutsReady(profile: RecoveryProfile): boolean {
  return profile.stripe_connected === true;
}

/** Whether they ever reached Stripe, which changes the wording only. */
export function stripeStarted(profile: RecoveryProfile): boolean {
  return Boolean(profile.stripe_account_id);
}

export function recoveryState(profile: RecoveryProfile): RecoveryState {
  const done = profileComplete(profile);
  const paid = payoutsReady(profile);

  if (done && paid) return "ready";
  if (done) return "B";
  if (paid) return "C";
  return "A";
}

/** What is genuinely outstanding, in the order the DJ should do it. */
export function outstanding(profile: RecoveryProfile): string[] {
  const missing: string[] = [];

  if (!profile.dj_name || profile.dj_name === PLACEHOLDER_NAME) missing.push("name");
  if (!profile.profile_image_url) missing.push("photo");
  if ((profile.request_price ?? 0) <= 0) missing.push("price");
  if (!payoutsReady(profile)) missing.push("payouts");

  return missing;
}

/**
 * Where the button goes. Never the homepage, never the dashboard root.
 *
 * Only two destinations exist today because only two exist in the
 * product: settings holds name, photo and price on one page, and
 * payments is its own route. Pretending to deep-link to a field that has
 * no anchor would be a worse lie than landing on the page that has it.
 */
export function nextStepHref(
  profile: RecoveryProfile,
  /*
   * The marker names which email the DJ arrived from, which is the whole
   * basis of first-party return attribution. It has to differ from the
   * in-product "onboarding" value, because four buttons on the Onboarding
   * screen already produce that one and a shared marker cannot tell an
   * email click from a tap inside the app. That ambiguity is exactly why
   * the first nine sends can never be attributed.
   */
  from: RecoveryTemplate | "onboarding" = "onboarding"
): string {
  return profileComplete(profile)
    ? `/dj/settings/payments?from=${from}`
    : `/dj/settings?from=${from}`;
}

const daysBetween = (from: string, now: Date) =>
  (now.getTime() - new Date(from).getTime()) / 86_400_000;

export type PriorSend = {
  template_key: RecoveryTemplate;
  status: "claimed" | "sent" | "failed";
  attempts: number;
  created_at: string;
  sent_at: string | null;
};

export type EligibilityVerdict =
  | { eligible: true; template: RecoveryTemplate; state: Exclude<RecoveryState, "ready"> }
  | { eligible: false; reason: string };

/**
 * The single decision, evaluated fresh immediately before every send.
 *
 * Ordered so the strongest reasons to say no are checked first, and so
 * the reason returned is the true one rather than whichever happened to
 * be tested last.
 */
export function recoveryVerdict(
  profile: RecoveryProfile,
  requests: LifecycleRequest[],
  priorSends: PriorSend[],
  now: Date
): EligibilityVerdict {
  if (isInternalDj(profile.slug)) {
    return { eligible: false, reason: "internal account" };
  }

  if (profile.lifecycle_emails_opted_out === true) {
    return { eligible: false, reason: "opted out of setup reminders" };
  }

  /* Activation ends this sequence permanently, and it is checked before
     state so that a DJ who took a paid request never receives a nudge
     about setup even if some field is still blank. */
  if (requests.some(isPaidAcceptedRequest)) {
    return { eligible: false, reason: "already activated" };
  }

  const state = recoveryState(profile);

  if (state === "ready") {
    return { eligible: false, reason: "ready to activate" };
  }

  const age = daysBetween(profile.created_at, now);
  const r1 = priorSends.find((s) => s.template_key === "recovery_1");
  const r2 = priorSends.find((s) => s.template_key === "recovery_2");

  /* A row in any state means that email is spoken for. 'claimed' is
     included deliberately: its provider outcome is unknown, and the
     approved rule is that uncertainty is never resolved by sending
     again. */
  if (!r1) {
    if (age < R1_DAY) return { eligible: false, reason: `too new (${age.toFixed(1)}d)` };
    return { eligible: true, template: "recovery_1", state };
  }

  if (r1.status === "failed" && r1.attempts < MAX_EMAIL_ATTEMPTS) {
    return { eligible: true, template: "recovery_1", state };
  }

  if (r1.status !== "sent") {
    return {
      eligible: false,
      reason:
        r1.status === "claimed"
          ? "first reminder delivery uncertain"
          : "first reminder failed and is out of attempts",
    };
  }

  if (r2) {
    if (r2.status === "failed" && r2.attempts < MAX_EMAIL_ATTEMPTS) {
      return { eligible: true, template: "recovery_2", state };
    }

    return { eligible: false, reason: `second reminder already ${r2.status}` };
  }

  if (age < R2_DAY) return { eligible: false, reason: `not yet day ${R2_DAY}` };

  const sinceR1 = r1.sent_at ? daysBetween(r1.sent_at, now) : 0;

  if (sinceR1 < R2_MIN_GAP_DAYS) {
    return { eligible: false, reason: `only ${sinceR1.toFixed(1)}d since the first reminder` };
  }

  return { eligible: true, template: "recovery_2", state };
}
