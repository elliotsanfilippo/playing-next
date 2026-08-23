/*
 * Audit, and if necessary repair, stripe_connected against Stripe.
 *
 * Written for the Phase 5D migration, which turned out not to be needed:
 * that column used to mean
 *
 *   details_submitted && payouts_enabled && transfers active && nothing due
 *
 * and now means one thing, can a destination transfer to this account
 * succeed. Rows written under the old formula could have said false for
 * a DJ perfectly able to receive earnings, and since the column gates
 * guest checkout those DJs would have been unable to take any requests.
 * The live dry run found no such rows, so nothing was applied.
 *
 * It is kept as maintenance tooling rather than deleted, because the
 * question it answers recurs: does the cached flag still agree with
 * Stripe. A dry run is a drift audit — any DJ listed as WOULD change is
 * one whose checkout gate is out of step with their real account, which
 * is worth knowing whether it was caused by a semantics change, a missed
 * account.updated webhook, or something new.
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
 * .env.local. Note that this needs the key in hand: the live key is a
 * Vercel Sensitive variable and cannot be read back out, so a live run
 * from here is only possible for someone who holds it separately. The
 * 5D migration was run instead from a temporary admin route inside
 * Production, which has since been deleted. Recreate that route from
 * git history if a live run is ever needed again rather than exposing
 * the key.
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
