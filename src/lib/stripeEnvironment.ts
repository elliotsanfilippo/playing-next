/*
 * Which Stripe environment is this process talking to, and therefore
 * which Connect account belongs to a DJ right now.
 *
 * Every Stripe client in the app is built from one STRIPE_SECRET_KEY, so
 * the mode of that key is the only thing that decides whether we are in
 * live or test. That was fine until it met Connect: dj_profiles stored a
 * single stripe_account_id, every stored account was live, and a
 * test-mode destination charge aimed at a live account is rejected
 * outright ("No such destination"). The happy path simply could not be
 * run outside production.
 *
 * So the test identifiers live in their own columns and this module
 * decides which pair to read. The important property is that the two
 * environments cannot see each other's data: live code never reads or
 * writes stripe_test_*, and test code never reads or writes the live
 * columns. Overwriting a live Connect id with a sandbox one would break
 * a real DJ's real payouts and could not be undone from our side.
 */

export type StripeMode = "live" | "test";

export class StripeEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeEnvironmentError";
  }
}

/*
 * The mode is derived only from an explicit sk_live_ or sk_test_ prefix,
 * and anything else throws.
 *
 * This used to treat "not live" as test, which meant a missing or
 * malformed key silently resolved to test mode. That fails safe locally
 * but is dangerous in a deployed environment: a process that lost its
 * STRIPE_SECRET_KEY would quietly start reading stripe_test_account_id,
 * find nothing there for real DJs, and tell every guest the DJ had not
 * finished setting up payments — a total outage presented as a routine
 * product state, with nothing in the logs pointing at configuration.
 *
 * Refusing to guess turns that into an immediate, obvious 500 naming the
 * exact variable. A payments system should not infer which environment
 * it is in.
 *
 * Restricted keys (rk_live_ / rk_test_) are deliberately not accepted:
 * nothing here uses one, and silently widening what counts as a valid
 * key is how the original loose check happened in the first place.
 */
export function stripeMode(): StripeMode {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new StripeEnvironmentError(
      "STRIPE_SECRET_KEY is not set. Playing Next cannot determine whether " +
        "it is running against live or test Stripe, and will not guess."
    );
  }

  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";

  throw new StripeEnvironmentError(
    "STRIPE_SECRET_KEY is malformed: expected it to begin with \"sk_live_\" " +
      "or \"sk_test_\". Playing Next will not guess which Stripe " +
      "environment it is running against."
  );
}

export const isLiveStripe = () => stripeMode() === "live";

/*
 * Anything holding both pairs. Deliberately loose so callers can pass a
 * partial Supabase row without restating its shape.
 */
export type ConnectProfileFields = {
  stripe_account_id?: string | null;
  stripe_connected?: boolean | null;
  stripe_test_account_id?: string | null;
  stripe_test_connected?: boolean | null;
};

export type ResolvedConnectAccount = {
  accountId: string | null;
  /**
   * Can a destination transfer to this account succeed. That is the
   * whole meaning, and it is the only question guest checkout needs
   * answered.
   *
   * It used to also require payouts_enabled and an empty requirements
   * list, which made a paused bank payout indistinguishable from a
   * broken account and stopped the DJ taking requests at all. Payout
   * health is real, but it is read live from Stripe on the payments
   * page rather than folded in here — see src/lib/connectHealth.ts.
   */
  connected: boolean;
  mode: StripeMode;
};

export function resolveConnectAccount(
  profile: ConnectProfileFields | null | undefined
): ResolvedConnectAccount {
  const mode = stripeMode();

  if (!profile) return { accountId: null, connected: false, mode };

  if (mode === "live") {
    return {
      accountId: profile.stripe_account_id ?? null,
      connected: profile.stripe_connected === true,
      mode,
    };
  }

  return {
    accountId: profile.stripe_test_account_id ?? null,
    connected: profile.stripe_test_connected === true,
    mode,
  };
}

/*
 * Column names to write back to, so a route that provisions or updates a
 * Connect account puts it in the right pair without branching inline.
 */
export function connectColumns(): {
  accountId: "stripe_account_id" | "stripe_test_account_id";
  connected: "stripe_connected" | "stripe_test_connected";
} {
  return isLiveStripe()
    ? { accountId: "stripe_account_id", connected: "stripe_connected" }
    : {
        accountId: "stripe_test_account_id",
        connected: "stripe_test_connected",
      };
}

/** Select list for any query that needs to resolve a Connect account.
 *  Both pairs are fetched; resolveConnectAccount picks. */
export const CONNECT_SELECT =
  "stripe_account_id, stripe_connected, stripe_test_account_id, stripe_test_connected";

/*
 * Shared message for "this DJ cannot take payments in this environment".
 * In live it means the DJ has not finished onboarding. In test it usually
 * means nobody has set up a sandbox account for them, which is a
 * developer-facing problem, not something a guest caused — so the copy
 * stays the same but the log line below distinguishes them.
 */
export const CONNECT_NOT_READY_MESSAGE =
  "This DJ has not finished setting up payments yet. Please try again later.";

export function logConnectNotReady(context: string, djSlugOrId: string) {
  const mode = stripeMode();

  console.error(
    mode === "test"
      ? `[${context}] No usable TEST Connect account for ${djSlugOrId}. ` +
          `Onboard one in Stripe test mode and set stripe_test_account_id.`
      : `[${context}] DJ ${djSlugOrId} has no connected live Stripe account.`
  );
}
