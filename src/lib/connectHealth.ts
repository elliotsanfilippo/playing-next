import type Stripe from "stripe";

/*
 * What a DJ's Stripe Connect account can actually do for them right now.
 *
 * This exists because one boolean was answering two unrelated questions.
 * `stripe_connected` was written as
 *
 *   details_submitted && payouts_enabled && transfers active && nothing due
 *
 * and it gates guest checkout. Playing Next uses destination charges, so
 * the only thing that decides whether a guest's money can reach a DJ is
 * the transfers capability. `payouts_enabled` decides something else
 * entirely: whether Stripe will move the resulting balance on to their
 * bank. Stripe pauses payouts routinely, during document review or when
 * a bank account goes stale, and adds `currently_due` items as
 * verification thresholds are crossed.
 *
 * Under the old formula either of those cut the DJ off from taking any
 * requests at all, immediately, because the account.updated webhook
 * writes the flag the moment Stripe changes anything. A DJ mid-set could
 * be told by every guest that they had "not finished setting up
 * payments" while their account was perfectly capable of receiving the
 * money.
 *
 * So the two questions are kept apart here, and every consumer asks the
 * one it actually cares about.
 */

/**
 * Why Stripe has restricted an account, in the only terms worth acting
 * on. Raw `disabled_reason` codes are never shown to a DJ.
 */
export type RestrictionKind =
  | "none"
  /** Stripe wants information now; ordinary verification. */
  | "action_required"
  /** Stripe has what it needs and is checking it. Nothing to do. */
  | "verification_pending"
  /** Stripe has stopped the account. Not something a form fixes. */
  | "restricted";

/*
 * disabled_reason values split into "the DJ can fix this" and "the DJ
 * cannot". The first group is the everyday case and must not be treated
 * as an outage; the second is genuinely blocking and is where money
 * stops.
 *
 * Anything unrecognised is deliberately treated as restricted rather
 * than waved through. A reason we cannot read is not a reason to assume
 * the account is fine, and Stripe adds new ones over time.
 */
const ACTION_REASONS = ["requirements.past_due", "requirements.pending_deadline"];
const PENDING_REASONS = ["requirements.pending_verification", "under_review"];

export function classifyRestriction(
  disabledReason: string | null | undefined
): RestrictionKind {
  if (!disabledReason) return "none";
  if (ACTION_REASONS.includes(disabledReason)) return "action_required";
  if (PENDING_REASONS.includes(disabledReason)) return "verification_pending";
  return "restricted";
}

/** The states a DJ is shown, in worsening order of what they can do. */
export type ConnectState =
  /** Transfers active, payouts on, nothing outstanding. */
  | "ready"
  /** Earnings still arrive; Stripe has paused or queried bank payouts. */
  | "payouts_paused"
  /** An account exists but cannot receive Playing Next transfers yet. */
  | "setup_incomplete"
  /** Stripe has restricted the account beyond ordinary verification. */
  | "restricted"
  /** No Connect account at all. */
  | "not_connected";

export type PayoutDestination = {
  bankName: string | null;
  last4: string | null;
  /** "manual" or an automatic interval. Only shown when it tells the DJ
   *  something they did not already know. */
  schedule: string | null;
};

export type ConnectHealth = {
  state: ConnectState;
  /**
   * The question guest checkout asks. True when a destination transfer
   * to this account can actually succeed.
   */
  canReceiveEarnings: boolean;
  /** Whether Stripe will move the balance on to their bank. */
  canPayOut: boolean;
  /** Onboarding form completed. The minimum for a Stripe dashboard link. */
  detailsSubmitted: boolean;
  restriction: RestrictionKind;
  /** Stripe wants something now. Count only: the keys are never shown. */
  requirementsDue: number;
  /** Stripe will want something later. Worth a gentle mention, no CTA. */
  requirementsUpcoming: number;
  destination: PayoutDestination | null;
};

/**
 * Can a destination transfer to this account succeed?
 *
 * The transfers capability is the direct answer, and it is
 * self-correcting: when Stripe restricts an account it deactivates the
 * capability, so this follows without needing to enumerate reasons. The
 * restriction check is belt and braces for the window where a capability
 * still reads active under a hard restriction, and it fails closed.
 */
function canReceive(account: Stripe.Account): boolean {
  const transfersActive = account.capabilities?.transfers === "active";
  const restriction = classifyRestriction(account.requirements?.disabled_reason);

  return transfersActive && restriction !== "restricted";
}

function readDestination(account: Stripe.Account): PayoutDestination | null {
  const external = account.external_accounts?.data ?? [];

  /* The default bank account for the account's own currency is the one
   * money actually goes to. Cards are possible on some accounts and are
   * deliberately ignored: this is a payout destination, not a wallet. */
  const bank = external.find(
    (item): item is Stripe.BankAccount =>
      item.object === "bank_account" && item.default_for_currency === true
  ) ?? external.find(
    (item): item is Stripe.BankAccount => item.object === "bank_account"
  );

  if (!bank) return null;

  return {
    /* Name and last four only. Never the account or sort code, which
     * Stripe does not return in full anyway and which we would have no
     * reason to display if it did. */
    bankName: bank.bank_name ?? null,
    last4: bank.last4 ?? null,
    schedule: account.settings?.payouts?.schedule?.interval ?? null,
  };
}

/** The whole model, from one Stripe Account object and nothing else. */
export function readConnectHealth(account: Stripe.Account): ConnectHealth {
  const detailsSubmitted = Boolean(account.details_submitted);
  const restriction = classifyRestriction(account.requirements?.disabled_reason);
  const canReceiveEarnings = canReceive(account);
  const canPayOut = Boolean(account.payouts_enabled);
  const requirementsDue = (account.requirements?.currently_due ?? []).length;
  const requirementsUpcoming = (account.requirements?.eventually_due ?? []).length;

  const state: ConnectState = !canReceiveEarnings
    ? restriction === "restricted"
      ? "restricted"
      : "setup_incomplete"
    : canPayOut && requirementsDue === 0 && restriction === "none"
      ? "ready"
      : "payouts_paused";

  return {
    state,
    canReceiveEarnings,
    canPayOut,
    detailsSubmitted,
    restriction,
    requirementsDue,
    requirementsUpcoming,
    destination: readDestination(account),
  };
}

/** The shape returned when there is no account to read at all. */
export const NO_ACCOUNT_HEALTH: ConnectHealth = {
  state: "not_connected",
  canReceiveEarnings: false,
  canPayOut: false,
  detailsSubmitted: false,
  restriction: "none",
  requirementsDue: 0,
  requirementsUpcoming: 0,
  destination: null,
};

/*
 * Why we could not read the account, when we could not.
 *
 * Kept separate from ConnectState on purpose: "we do not know" is not a
 * state the account is in, and rendering it as "not connected" is how
 * the old page invited a perfectly healthy DJ to start onboarding again.
 */
export type UnreachableReason =
  /** Stripe was unavailable or errored. The account is probably fine. */
  | "temporary"
  /** The stored id is not on this platform, or is in the wrong mode. */
  | "wrong_environment"
  /** Stripe says there is no such account. */
  | "missing";

export function classifyAccountError(error: unknown): UnreachableReason {
  const err = error as { statusCode?: number; type?: string; code?: string; message?: string };

  /* A permission error means the key cannot see the account: either it
   * belongs to a different platform, or a live id is being read with a
   * test key. Either way it is a stored-value problem, not an outage. */
  if (err?.type === "StripePermissionError" || err?.statusCode === 403) {
    return "wrong_environment";
  }

  if (err?.statusCode === 404 || /No such account/i.test(err?.message ?? "")) {
    return "missing";
  }

  return "temporary";
}
