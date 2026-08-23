import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
/* Relative, with extensions, because this module has two callers: the
   Next route, whose bundler resolves either form, and a plain node
   script run with --experimental-strip-types, which resolves neither
   the "@/" alias nor an extensionless specifier. */
import { readConnectHealth, type ConnectState } from "./connectHealth.ts";
import { connectColumns, stripeMode } from "./stripeEnvironment.ts";

/*
 * Recompute stripe_connected under the Phase 5D semantics.
 *
 * Rows written before 5D used the old formula, which folded
 * payouts_enabled and outstanding requirements into a flag that gates
 * guest checkout. A DJ having a payout held or a document checked can
 * therefore still read false and stay blocked from taking any requests.
 *
 * The logic lives here rather than in either caller because there are
 * two: a CLI script for anyone holding a key locally, and an admin route
 * for the case this was actually written for — a live key that exists
 * only inside Vercel Production as a Sensitive variable and cannot be
 * read out. Two copies of a backfill that writes to a checkout gate is
 * exactly the kind of drift this codebase keeps removing.
 *
 * Takes its clients as arguments so it has no environment of its own and
 * runs unchanged in a script or a serverless function.
 */

export type BackfillEntry = {
  djName: string | null;
  slug: string | null;
  accountId: string;
  current: boolean;
  /** Absent when the account could not be read. */
  next?: boolean;
  state?: ConnectState;
  canPayOut?: boolean;
  changed: boolean;
  /** Present only on failure. Never contains key material. */
  error?: string;
};

export type BackfillResult = {
  mode: "live" | "test";
  readColumn: string;
  writeColumn: string;
  apply: boolean;
  entries: BackfillEntry[];
  /** Profiles flagged connected with no account id to evaluate. Reported
   *  and deliberately left alone. */
  anomalies: { djName: string | null; slug: string | null }[];
  summary: {
    profiles: number;
    checked: number;
    unchanged: number;
    wouldChange: number;
    changed: number;
    failed: number;
    anomalies: number;
    /** Counted, not asserted: a dry run proves it wrote nothing. */
    writesAttempted: number;
  };
};

/*
 * Stripe masks keys in its own error text, but only to the last four
 * characters. That is still key material in a log or an HTTP response,
 * and this runs where the key is deliberately unreadable to its owner.
 */
const scrub = (text: string) =>
  text.replace(/\b[sr]k_(live|test)_[A-Za-z0-9*_-]+/g, "[key hidden]");

export async function backfillConnectStatus({
  stripe,
  supabase,
  apply,
}: {
  stripe: Stripe;
  supabase: SupabaseClient;
  apply: boolean;
}): Promise<BackfillResult> {
  /*
   * Both the column read and the column written come from one
   * connectColumns() call, which returns them as a matched pair derived
   * from the key's own prefix. A live key can only ever read
   * stripe_account_id and write stripe_connected; a test key can only
   * touch the stripe_test_* pair. Nothing here can select them
   * independently, so the two environments cannot be crossed.
   */
  const mode = stripeMode();
  const columns = connectColumns();

  const { data, error } = await supabase
    .from("dj_profiles")
    .select(`id, dj_name, slug, ${columns.accountId}, ${columns.connected}`)
    .order("dj_name");

  if (error) throw new Error(`Could not load DJ profiles: ${error.message}`);

  const rows = (data ?? []) as Record<string, unknown>[];

  const anomalies = rows
    .filter((row) => !row[columns.accountId] && row[columns.connected] === true)
    .map((row) => ({
      djName: (row.dj_name as string) ?? null,
      slug: (row.slug as string) ?? null,
    }));

  const withAccounts = rows.filter((row) => Boolean(row[columns.accountId]));

  const entries: BackfillEntry[] = [];
  let writesAttempted = 0;

  for (const row of withAccounts) {
    const accountId = row[columns.accountId] as string;
    const current = row[columns.connected] === true;
    const base = {
      djName: (row.dj_name as string) ?? null,
      slug: (row.slug as string) ?? null,
      accountId,
      current,
    };

    let health;

    try {
      /* Read only. Nothing in this backfill writes to Stripe. */
      const account = await stripe.accounts.retrieve(accountId);
      health = readConnectHealth(account);
    } catch (caughtError) {
      /* One DJ failing must not end the run: the next may be the one
         that is actually blocked. */
      entries.push({
        ...base,
        changed: false,
        error: scrub(
          caughtError instanceof Error ? caughtError.message : String(caughtError)
        ).slice(0, 160),
      });
      continue;
    }

    const next = health.canReceiveEarnings;

    if (next === current || !apply) {
      entries.push({
        ...base,
        next,
        state: health.state,
        canPayOut: health.canPayOut,
        changed: false,
      });
      continue;
    }

    /* The only write, and only ever this one column. Account ids, payout
       settings and capabilities are never touched. */
    writesAttempted += 1;

    const { error: updateError } = await supabase
      .from("dj_profiles")
      .update({ [columns.connected]: next })
      .eq("id", row.id as string);

    entries.push({
      ...base,
      next,
      state: health.state,
      canPayOut: health.canPayOut,
      changed: !updateError,
      ...(updateError ? { error: scrub(updateError.message).slice(0, 160) } : {}),
    });
  }

  const failed = entries.filter((e) => e.error).length;
  const differing = entries.filter(
    (e) => !e.error && e.next !== undefined && e.next !== e.current
  );

  return {
    mode,
    readColumn: columns.accountId,
    writeColumn: columns.connected,
    apply,
    entries,
    anomalies,
    summary: {
      profiles: rows.length,
      checked: entries.length,
      unchanged: entries.filter((e) => !e.error && e.next === e.current).length,
      wouldChange: apply ? 0 : differing.length,
      changed: entries.filter((e) => e.changed).length,
      failed,
      anomalies: anomalies.length,
      writesAttempted,
    },
  };
}
