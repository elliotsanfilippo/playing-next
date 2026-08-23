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
import { backfillConnectStatus } from "../src/lib/backfillConnectStatus.ts";
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

async function run() {
  console.log("");
  console.log("  Stripe mode      " + mode.toUpperCase());
  console.log("  Reads column     " + columns.accountId);
  console.log("  Writes column    " + columns.connected);
  console.log("  Mode             " + (APPLY ? "APPLY (writes)" : "DRY RUN (no writes)"));
  console.log("");

  /* Same function the admin route runs, so the two cannot disagree
     about what a backfill does. */
  const result = await backfillConnectStatus({ stripe, supabase, apply: APPLY });

  for (const anomaly of result.anomalies) {
    console.log(
      `  ANOMALY  ${(anomaly.djName ?? anomaly.slug ?? "?").padEnd(18)} ` +
        `${columns.connected}=true with no ${columns.accountId}. Not changed.`
    );
  }

  console.log(
    `  ${result.summary.checked} of ${result.summary.profiles} DJs have a ${mode} Connect account.\n`
  );

  for (const entry of result.entries) {
    const label = (entry.djName ?? entry.slug ?? entry.accountId).padEnd(18);

    if (entry.error) {
      console.log(`  FAILED   ${label} ${entry.accountId}  ${entry.error.slice(0, 90)}`);
      continue;
    }

    if (entry.next === entry.current) {
      console.log(`  ok       ${label} ${String(entry.current).padEnd(5)} state=${entry.state}`);
      continue;
    }

    const arrow = `${entry.current} -> ${entry.next}`;

    console.log(
      `  ${entry.changed ? "CHANGED " : "WOULD   "} ${label} ${arrow.padEnd(16)} ` +
        `state=${entry.state} payouts=${entry.canPayOut}`
    );
  }

  const s = result.summary;

  console.log("");
  console.log("  ── Summary ──────────────────────────────");
  console.log(`  checked       ${s.checked}`);
  console.log(`  unchanged     ${s.unchanged}`);
  console.log(APPLY ? `  changed       ${s.changed}` : `  would change  ${s.wouldChange}`);
  console.log(`  failed        ${s.failed}`);
  console.log(`  anomalies     ${s.anomalies}`);
  console.log(
    `  writes made   ${s.writesAttempted}` + (APPLY ? "" : "   (dry run cannot write)")
  );
  console.log("");

  if (!APPLY && s.wouldChange > 0) {
    console.log(
      "  Nothing was written. Re-run with --apply" +
        (mode === "live" ? " --confirm-live" : "") +
        " to apply.\n"
    );
  }
}

run().catch((error) => {
  console.error(
    "Backfill aborted:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
