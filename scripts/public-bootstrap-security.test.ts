/*
 * The guest request page is the surface that took production down on
 * 2026-09-03, by reading two columns of commercial account state in a
 * guest's browser. R6 server-renders that page, which means DJ data now
 * travels inside the HTML — so the question "what can a guest see?"
 * became "what is in the serialized output?" as well as "what can anon
 * query?".
 *
 * This test answers both, and it checks values as well as field names.
 * Checking only names would let a future refactor rename a property to
 * something innocuous and quietly keep shipping the same secret.
 *
 * Run with:
 *   node --experimental-strip-types --test scripts/public-bootstrap-security.test.ts
 *
 * Set TARGET to test a deployed origin instead of the default.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [
        line.slice(0, index).trim(),
        line.slice(index + 1).trim().replace(/^["']|["']$/g, ""),
      ];
    })
);

for (const [key, value] of Object.entries(env)) {
  if (!process.env[key]) process.env[key] = value as string;
}

/* Imported after the environment is populated: the module builds its
   Supabase client at import time, so a static import would run before
   these variables exist. */
const { fetchPublicDjBootstrap, PUBLIC_BOOTSTRAP_FIELDS } = await import(
  "../src/lib/publicDjBootstrap.ts"
);

const TARGET = process.env.TARGET ?? "https://playingnextapp.com";
const SLUG = process.env.TEST_SLUG ?? "elliotsanfilippo26";
const PRO_SLUG = process.env.TEST_PRO_SLUG ?? "dj-elliot-test";

/* Field names that must never appear in anything a guest receives. */
const FORBIDDEN_FIELDS = [
  "plan",
  "stripe_subscription_status",
  "stripe_account_id",
  "stripe_test_account_id",
  "stripe_customer_id",
  "stripe_subscription_id",
  "stripe_connected",
  "stripe_test_connected",
  "user_id",
  "max_pending_requests",
  "max_queue_requests",
  "onboarding_complete",
  "qr_box_eligible",
  "qr_box_claimed",
  "hidden_from_discovery",
  /* camelCase spellings too - a serializer that renames the property
     must not be able to slip past this list. */
  "stripeAccountId",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "stripeSubscriptionStatus",
  "maxPendingRequests",
  "maxQueueRequests",
  "userId",
];

/* Representative VALUES, so renaming a property does not defeat the
   test. Prefixes are matched anywhere in the payload. */
const FORBIDDEN_VALUE_PATTERNS: Array<[string, RegExp]> = [
  ["Stripe account id", /\bacct_[A-Za-z0-9]{6,}/],
  ["Stripe customer id", /\bcus_[A-Za-z0-9]{6,}/],
  ["Stripe subscription id", /\bsub_[A-Za-z0-9]{6,}/],
  ["Stripe price id", /\bprice_[A-Za-z0-9]{6,}/],
  ["Stripe live secret key", /\bsk_live_[A-Za-z0-9]{6,}/],
  ["Stripe test secret key", /\bsk_test_[A-Za-z0-9]{6,}/],
  ["Supabase service role JWT", /\bservice_role\b/],
  /* The literal subscription-status vocabulary. "active" alone is far
     too common in HTML, so each is anchored to a quoted string. */
  ["subscription status value", /"(trialing|past_due|incomplete_expired|unpaid)"/],
];

function scan(label: string, payload: string) {
  for (const field of FORBIDDEN_FIELDS) {
    assert.ok(
      !new RegExp(`["'\\b]${field}["'\\b:]`).test(payload),
      `${label}: forbidden field name "${field}" appears in the payload`
    );
  }

  for (const [name, pattern] of FORBIDDEN_VALUE_PATTERNS) {
    const match = payload.match(pattern);
    assert.ok(
      !match,
      `${label}: forbidden ${name} value appears in the payload: ${match?.[0]}`
    );
  }
}

test("the runtime DTO exposes only the declared fields", async () => {
  const result = await fetchPublicDjBootstrap(SLUG);

  assert.equal(result.status, "ok", "expected the test DJ to resolve");
  if (result.status !== "ok") return;

  const keys = Object.keys(result.dj).sort();
  assert.deepEqual(
    keys,
    [...PUBLIC_BOOTSTRAP_FIELDS].sort(),
    "the DTO grew or lost a field without the allowlist being updated"
  );

  scan("runtime DTO", JSON.stringify(result.dj));
});

test("the Pro DJ's DTO leaks no entitlement detail", async () => {
  const result = await fetchPublicDjBootstrap(PRO_SLUG);

  if (result.status !== "ok") return; /* absent in this environment */

  assert.deepEqual(
    Object.keys(result.dj).sort(),
    [...PUBLIC_BOOTSTRAP_FIELDS].sort()
  );

  /* An entitled Pro DJ may legitimately have an effective event. What
     must not be inferable is the subscription state behind it. */
  scan("Pro DTO", JSON.stringify(result.dj));
});

test("a missing DJ is not_found, and is distinct from an error", async () => {
  const result = await fetchPublicDjBootstrap(
    "definitely-not-a-real-dj-slug-9f3a2b"
  );

  assert.equal(result.status, "not_found");
  assert.notEqual(
    result.status,
    "error",
    "absence must never be reported as failure, or vice versa"
  );
});

test("the served HTML and RSC payload contain no private field or value", async () => {
  const response = await fetch(`${TARGET}/request/${SLUG}`, {
    headers: { "cache-control": "no-cache" },
  });

  assert.equal(response.status, 200);
  const html = await response.text();

  /* Sanity: we are scanning a page that actually rendered the DJ, not an
     error shell that would trivially pass. */
  assert.ok(
    /REQUESTS FOR/i.test(html) || /ELSAN/i.test(html),
    "expected the server-rendered DJ identity in the HTML"
  );

  scan("served HTML + RSC payload", html);
});

test("the Pro DJ's served HTML contains no entitlement detail", async () => {
  const response = await fetch(`${TARGET}/request/${PRO_SLUG}`);
  if (response.status !== 200) return;

  scan("Pro served HTML", await response.text());
});

test("anon still cannot read private dj_profiles columns directly", async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const privateColumns = [
    "plan",
    "stripe_subscription_status",
    "stripe_account_id",
    "stripe_test_account_id",
    "stripe_customer_id",
    "stripe_subscription_id",
    "stripe_connected",
    "user_id",
    "max_pending_requests",
    "max_queue_requests",
  ];

  for (const column of privateColumns) {
    const response = await fetch(
      `${url}/rest/v1/dj_profiles?select=${column}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );

    assert.equal(
      response.status,
      401,
      `anon can read dj_profiles.${column} - the column grants have been widened`
    );
  }
});

test("anon cannot reach private columns through the public view either", async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  for (const column of ["plan", "stripe_subscription_status", "user_id"]) {
    const response = await fetch(
      `${url}/rest/v1/public_dj_request_bootstrap?select=${column}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );

    assert.notEqual(
      response.status,
      200,
      `the view exposes ${column} - its select list has been widened`
    );
  }
});
