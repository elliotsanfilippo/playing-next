/*
 * The song-request Connect guard, checked without a database and
 * without sending anything anywhere.
 *
 * Part one is pure: resolveConnectAccount across every combination of
 * account id present or absent and connected true or false, in both
 * Stripe modes, asserting what the guard in app/api/request/create
 * would decide.
 *
 * Part two replays the guard over the REAL Production profile rows,
 * read-only, and asserts it refuses exactly the DJs who cannot receive
 * a destination transfer. No row is written and no request is created.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { resolveConnectAccount } from "../src/lib/stripeEnvironment.ts";

/** The guard's decision, expressed once so the test cannot drift from it. */
const wouldRefuse = (profile: Parameters<typeof resolveConnectAccount>[0]) => {
  const connect = resolveConnectAccount(profile);
  return !connect.accountId || !connect.connected;
};

const LIVE = "sk_live_x";
const TEST = "sk_test_x";

function withKey<T>(key: string, run: () => T): T {
  const previous = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = key;
  try {
    return run();
  } finally {
    process.env.STRIPE_SECRET_KEY = previous;
  }
}

test("live mode: refuses unless the live account is present and connected", () => {
  withKey(LIVE, () => {
    assert.equal(wouldRefuse({ stripe_account_id: "acct_1", stripe_connected: true }), false);
    assert.equal(wouldRefuse({ stripe_account_id: "acct_1", stripe_connected: false }), true);
    assert.equal(wouldRefuse({ stripe_account_id: null, stripe_connected: true }), true);
    assert.equal(wouldRefuse({ stripe_account_id: null, stripe_connected: false }), true);
    assert.equal(wouldRefuse(null), true);
  });
});

test("live mode ignores the sandbox columns entirely", () => {
  withKey(LIVE, () => {
    /* A DJ with a working sandbox account and no live one must still be
       refused: a test-mode destination is not a live one. */
    assert.equal(
      wouldRefuse({
        stripe_account_id: null,
        stripe_connected: false,
        stripe_test_account_id: "acct_test",
        stripe_test_connected: true,
      }),
      true
    );
  });
});

test("test mode reads the sandbox pair, not the live pair", () => {
  withKey(TEST, () => {
    assert.equal(
      wouldRefuse({
        stripe_account_id: "acct_live",
        stripe_connected: true,
        stripe_test_account_id: null,
        stripe_test_connected: false,
      }),
      true
    );
    assert.equal(
      wouldRefuse({
        stripe_account_id: null,
        stripe_connected: false,
        stripe_test_account_id: "acct_test",
        stripe_test_connected: true,
      }),
      false
    );
  });
});

test("a missing Stripe key throws rather than guessing an environment", () => {
  withKey("", () => {
    assert.throws(() => wouldRefuse({ stripe_account_id: "acct_1", stripe_connected: true }));
  });
});

test("replay over real Production profiles, read-only", async () => {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );

  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await db
    .from("dj_profiles")
    .select("slug, stripe_account_id, stripe_connected, stripe_test_account_id, stripe_test_connected");

  assert.equal(error, null);
  assert.ok(data && data.length > 0);

  withKey(LIVE, () => {
    const refused = data!.filter((p) => wouldRefuse(p)).map((p) => p.slug);
    const allowed = data!.filter((p) => !wouldRefuse(p)).map((p) => p.slug);

    /* Every refusal must be a DJ whose live connected flag is not true,
       and every allowance must have both halves. Stated as properties
       rather than as a hard-coded list, so the test stays true as DJs
       finish onboarding. */
    for (const p of data!) {
      const expected = !(p.stripe_account_id && p.stripe_connected === true);
      assert.equal(wouldRefuse(p), expected, `guard disagreed for ${p.slug}`);
    }

    console.log(`  refused ${refused.length}: ${refused.join(", ")}`);
    console.log(`  allowed ${allowed.length}: ${allowed.join(", ")}`);
  });
});
