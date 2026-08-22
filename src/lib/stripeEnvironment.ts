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

export function stripeMode(): StripeMode {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live")
    ? "live"
    : "test";
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
  /** Onboarding finished: charges and payouts enabled. */
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
