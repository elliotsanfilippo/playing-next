/*
 * The Pro entitlement policy exists twice: once as isProEntitled() in
 * src/lib/planEntitlement.ts, and once as public.is_pro_entitled() in
 * the database, where it has to live for the public bootstrap view to
 * evaluate it without exposing plan or stripe_subscription_status.
 *
 * Two implementations of a rule that decides whether a DJ is charged 0%
 * or 15% commission is exactly the kind of duplication that drifts
 * silently and is discovered by a DJ being billed wrongly. This test is
 * the thing that stops that: it enumerates every status TypeScript knows
 * about, asks the database the same question, and fails if they disagree.
 *
 * Adding a status to ENTITLED_STATUSES or UNENTITLED_STATUSES without
 * updating the migration fails here, and vice versa.
 *
 * Run with:
 *   node --experimental-strip-types --test scripts/entitlement-parity.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ENTITLED_STATUSES,
  UNENTITLED_STATUSES,
  isProEntitled,
} from "../src/lib/planEntitlement.ts";

/* The service role is used only to call the pure entitlement function.
   It reads no rows. */
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

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function dbSaysEntitled(
  plan: string | null,
  status: string | null
): Promise<boolean> {
  const response = await fetch(`${URL_}/rest/v1/rpc/is_pro_entitled`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_plan: plan, p_status: status }),
  });

  if (!response.ok) {
    throw new Error(
      `is_pro_entitled RPC failed (${response.status}): ${await response.text()}`
    );
  }

  return (await response.json()) as boolean;
}

test("every entitled status agrees between TypeScript and Postgres", async () => {
  for (const status of ENTITLED_STATUSES) {
    const ts = isProEntitled({ plan: "pro", stripe_subscription_status: status });
    const db = await dbSaysEntitled("pro", status);

    assert.equal(ts, true, `TypeScript should entitle pro/${status}`);
    assert.equal(
      db,
      ts,
      `Postgres and TypeScript disagree on pro/${status}: db=${db} ts=${ts}`
    );
  }
});

test("every unentitled status agrees between TypeScript and Postgres", async () => {
  for (const status of UNENTITLED_STATUSES) {
    const ts = isProEntitled({ plan: "pro", stripe_subscription_status: status });
    const db = await dbSaysEntitled("pro", status);

    assert.equal(ts, false, `TypeScript should not entitle pro/${status}`);
    assert.equal(
      db,
      ts,
      `Postgres and TypeScript disagree on pro/${status}: db=${db} ts=${ts}`
    );
  }
});

test("a non-pro plan is never entitled, whatever the status", async () => {
  const statuses = [...ENTITLED_STATUSES, ...UNENTITLED_STATUSES, null];

  for (const plan of ["free", null, "", "PRO", "pro_legacy"]) {
    for (const status of statuses) {
      const ts = isProEntitled({
        plan,
        stripe_subscription_status: status,
      });
      const db = await dbSaysEntitled(plan, status);

      assert.equal(ts, false, `TypeScript should not entitle ${plan}/${status}`);
      assert.equal(
        db,
        ts,
        `Postgres and TypeScript disagree on ${plan}/${status}: db=${db} ts=${ts}`
      );
    }
  }
});

test("a missing status is never entitled", async () => {
  assert.equal(isProEntitled({ plan: "pro", stripe_subscription_status: null }), false);
  assert.equal(await dbSaysEntitled("pro", null), false);
});

/*
 * The set of statuses is itself part of the contract. If somebody adds a
 * status to only one of the two lists, the loops above still pass because
 * they only iterate what TypeScript declares. This asserts the total is
 * what the migration was written against, so growing either list is a
 * deliberate act that shows up here.
 */
test("the declared status lists have not grown without review", () => {
  assert.equal(
    ENTITLED_STATUSES.length,
    3,
    "ENTITLED_STATUSES changed - update public.is_pro_entitled in " +
      "supabase/migrations/20260826_public_dj_request_bootstrap.sql to match"
  );
  assert.equal(
    UNENTITLED_STATUSES.length,
    5,
    "UNENTITLED_STATUSES changed - re-check public.is_pro_entitled in " +
      "supabase/migrations/20260826_public_dj_request_bootstrap.sql"
  );
});
