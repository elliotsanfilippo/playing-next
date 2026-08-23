/*
 * Backfill stripe_connected under the Phase 5D semantics.
 *
 * Until 5D that column meant
 *
 *   details_submitted && payouts_enabled && transfers active && nothing due
 *
 * and it gates guest checkout. It now means one thing: can a destination
 * transfer to this account succeed. Rows written under the old formula
 * can therefore say false for a DJ who is perfectly able to receive
 * earnings — they are simply having a payout held or a document checked.
 * Those DJs stay blocked from taking any requests until something
 * refreshes them.
 *
 * They do self-heal: any account.updated webhook, or the DJ opening
 * their payments page, rewrites the flag correctly. This script exists
 * so nobody has to wait for that.
 *
 * ── Safety ───────────────────────────────────────────────────────────
 *
 * The mode comes from STRIPE_SECRET_KEY through the same resolver the
 * app uses, and both the column it READS and the column it WRITES come
 * from connectColumns(). Those are returned as a matched pair, so a live
 * key can only ever read stripe_account_id and write stripe_connected,
 * and a test key can only ever touch the stripe_test_* pair. There is no
 * argument, flag or environment variable that can cross them.
 *
 * It writes exactly one column. Account ids, payout settings, Connect
 * capabilities and every other profile field are never touched, and
 * nothing is written to Stripe at all — every Stripe call here is a
 * read.
 *
 * ── Usage ────────────────────────────────────────────────────────────
 *
 *   node --experimental-strip-types scripts/backfill-connect-status.ts
 *   node --experimental-strip-types scripts/backfill-connect-status.ts --apply --confirm-live
 *
 * Dry run is the default and prints proposed changes without writing.
 * Applying against live additionally requires --confirm-live, so an
 * apply cannot happen by muscle memory on the wrong environment.
 *
 * Credentials are read from the process environment, falling back to
 * .env.local. Point STRIPE_SECRET_KEY at the live key to backfill live.
 */

import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { readConnectHealth } from "../src/lib/connectHealth.ts";
import { connectColumns, stripeMode } from "../src/lib/stripeEnvironment.ts";

const APPLY = process.argv.includes("--apply");
const CONFIRM_LIVE = process.argv.includes("--confirm-live");

/* .env.local is only a fallback: anything already exported wins, so a
   one-off run can point at a different key without editing the file. */
function loadEnv() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const index = line.indexOf("=");
    if (index === -1 || line.trim().startsWith("#")) continue;

    const key = line.slice(0, index).trim();
    if (!process.env[key]) process.env[key] = line.slice(index + 1).trim();
  }
}

loadEnv();

/* Throws on a missing or malformed key rather than guessing an
   environment. That refusal is the point of the resolver. */
const mode = stripeMode();
const columns = connectColumns();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set."
  );
  process.exit(1);
}

if (APPLY && mode === "live" && !CONFIRM_LIVE) {
  console.error(
    "Refusing to apply against LIVE Stripe without --confirm-live.\n" +
      "Re-run with:  --apply --confirm-live"
  );
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = {
  id: string;
  dj_name: string | null;
  slug: string | null;
  [key: string]: unknown;
};

const summary = {
  checked: 0,
  unchanged: 0,
  wouldChange: 0,
  changed: 0,
  failed: 0,
  /* Not a change, but worth surfacing: a flag set true with no account
     to back it. Reported and deliberately not touched, because there is
     nothing to evaluate it against. */
  anomalies: 0,
};

async function run() {
  console.log("");
  console.log("  Stripe mode      " + mode.toUpperCase());
  console.log("  Reads column     " + columns.accountId);
  console.log("  Writes column    " + columns.connected);
  console.log("  Mode             " + (APPLY ? "APPLY (writes)" : "DRY RUN (no writes)"));
  console.log("");

  const { data, error } = await supabase
    .from("dj_profiles")
    .select(`id, dj_name, slug, ${columns.accountId}, ${columns.connected}`)
    .order("dj_name");

  if (error) {
    console.error("Could not load DJ profiles:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];

  /* Flagged connected with no account id at all. Cannot be evaluated,
     so it is reported rather than guessed at. */
  for (const row of rows) {
    if (!row[columns.accountId] && row[columns.connected] === true) {
      summary.anomalies += 1;
      console.log(
        `  ANOMALY  ${(row.dj_name ?? row.slug ?? row.id).padEnd(18)} ` +
          `${columns.connected}=true with no ${columns.accountId}. Not changed.`
      );
    }
  }

  const withAccounts = rows.filter((row) => Boolean(row[columns.accountId]));

  console.log(
    `  ${withAccounts.length} of ${rows.length} DJs have a ${mode} Connect account.\n`
  );

  for (const row of withAccounts) {
    const label = (row.dj_name ?? row.slug ?? row.id).padEnd(18);
    const accountId = row[columns.accountId] as string;
    const current = row[columns.connected] === true;

    summary.checked += 1;

    let health;

    try {
      /* Read only. Nothing in this script writes to Stripe. */
      const account = await stripe.accounts.retrieve(accountId);
      health = readConnectHealth(account);
    } catch (caughtError) {
      /* One DJ failing must not end the run: the next one may be the
         one that is actually blocked. */
      summary.failed += 1;
      const message =
        caughtError instanceof Error ? caughtError.message : String(caughtError);
      console.log(`  FAILED   ${label} ${accountId}  ${message.slice(0, 90)}`);
      continue;
    }

    const next = health.canReceiveEarnings;

    if (next === current) {
      summary.unchanged += 1;
      console.log(
        `  ok       ${label} ${String(current).padEnd(5)} ` +
          `state=${health.state}`
      );
      continue;
    }

    const arrow = `${current} -> ${next}`;

    if (!APPLY) {
      summary.wouldChange += 1;
      console.log(
        `  WOULD    ${label} ${arrow.padEnd(16)} state=${health.state} ` +
          `transfers=${next ? "active" : "not active"} payouts=${health.canPayOut}`
      );
      continue;
    }

    /* The only write in the script, and only ever this one column. */
    const { error: updateError } = await supabase
      .from("dj_profiles")
      .update({ [columns.connected]: next })
      .eq("id", row.id);

    if (updateError) {
      summary.failed += 1;
      console.log(`  FAILED   ${label} update: ${updateError.message}`);
      continue;
    }

    summary.changed += 1;
    console.log(`  CHANGED  ${label} ${arrow.padEnd(16)} state=${health.state}`);
  }

  console.log("");
  console.log("  ── Summary ──────────────────────────────");
  console.log(`  checked       ${summary.checked}`);
  console.log(`  unchanged     ${summary.unchanged}`);
  console.log(
    APPLY
      ? `  changed       ${summary.changed}`
      : `  would change  ${summary.wouldChange}`
  );
  console.log(`  failed        ${summary.failed}`);
  console.log(`  anomalies     ${summary.anomalies}`);
  console.log("");

  if (!APPLY && summary.wouldChange > 0) {
    console.log(
      "  Nothing was written. Re-run with --apply" +
        (mode === "live" ? " --confirm-live" : "") +
        " to apply.\n"
    );
  }
}

run().catch((error) => {
  console.error("Backfill aborted:", error);
  process.exit(1);
});
