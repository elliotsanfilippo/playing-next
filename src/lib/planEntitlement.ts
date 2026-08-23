/*
 * Whether a DJ is entitled to Pro right now.
 *
 * This used to be `plan === "pro" && status === "active"`, written out
 * by hand in eleven places. They all agreed, which was luck rather than
 * design, and the rule they agreed on was wrong at the edges: a DJ whose
 * renewal payment failed lost the 0% fee, Analytics, Events and
 * auto-close the instant Stripe marked them past_due — while Stripe was
 * still retrying the card and would very likely collect.
 *
 * Stripe's own semantics are the guide. past_due and trialing are both
 * live subscriptions: one is mid-dunning, the other is inside a trial
 * the platform granted. unpaid and paused are subscriptions Stripe has
 * stopped collecting for. incomplete never took a first payment, and
 * canceled and incomplete_expired are over.
 */

/** Stripe statuses that mean the subscription is live enough to bill
 *  against, so the DJ keeps everything Pro includes — the 0% platform
 *  fee included. */
export const ENTITLED_STATUSES = [
  "active",
  /* Inside a trial the platform granted. None is configured today, so
   * this is here to be correct rather than because it fires. */
  "trialing",
  /* Stripe is retrying the card. The DJ has not stopped paying; a
   * payment attempt has failed and dunning is under way. Dropping them
   * to 15% commission mid-retry charges them for Stripe's schedule. */
  "past_due",
] as const;

/** Statuses where there is no subscription to rely on. Listed rather
 *  than inferred, so a status Stripe adds later is not silently
 *  treated as entitled. */
export const UNENTITLED_STATUSES = [
  /* First payment never completed. Stripe expires these after ~23h. */
  "incomplete",
  "incomplete_expired",
  /* Stripe has given up collecting. */
  "unpaid",
  "paused",
  "canceled",
] as const;

export type PlanProfile = {
  plan?: string | null;
  stripe_subscription_status?: string | null;
};

/**
 * The single question every Pro gate asks.
 *
 * Both halves matter. `plan` is the app's own record that a
 * subscription exists at all, written by the subscription webhook, and
 * `stripe_subscription_status` is Stripe's verdict on it. An unknown or
 * missing status is not entitled: a status we cannot read is not a
 * reason to give something away, and it is certainly not a reason to
 * stop charging commission.
 */
export function isProEntitled(profile: PlanProfile | null | undefined): boolean {
  if (profile?.plan !== "pro") return false;

  const status = profile?.stripe_subscription_status;
  if (!status) return false;

  return (ENTITLED_STATUSES as readonly string[]).includes(status);
}

/**
 * Entitled, but Stripe wants attention. Worth telling the DJ about
 * without taking anything away from them.
 */
export function hasBillingProblem(
  profile: PlanProfile | null | undefined
): boolean {
  return isProEntitled(profile) && profile?.stripe_subscription_status === "past_due";
}

/**
 * Statuses after which starting a fresh checkout is safe.
 *
 * Anything else means a subscription already exists in some form, and
 * subscription-mode Checkout creates a new one every time it is called —
 * so a DJ sitting on a past_due or incomplete subscription could end up
 * paying for two. Those DJs belong in the billing portal, not at a
 * second till.
 */
export function canStartNewSubscription(
  profile: PlanProfile | null | undefined
): boolean {
  if (profile?.plan !== "pro") return true;

  const status = profile?.stripe_subscription_status;
  if (!status) return true;

  return ["canceled", "incomplete_expired"].includes(status);
}
