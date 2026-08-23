import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/src/lib/adminAuth";
import { backfillConnectStatus } from "@/src/lib/backfillConnectStatus";

/*
 * ── TEMPORARY. DELETE THIS FILE ONCE THE BACKFILL HAS BEEN APPLIED. ──
 *
 * A one-off migration that has to run where the live Stripe key is.
 *
 * Phase 5D narrowed what stripe_connected means, and rows written under
 * the old formula can still say false for a DJ who is perfectly able to
 * receive earnings — they are simply having a payout held or a document
 * checked. That flag gates guest checkout, so those DJs cannot take any
 * requests until something refreshes them.
 *
 * The CLI script does the same job, but it needs the key in hand. The
 * live key is a Vercel Sensitive variable: it cannot be read back out,
 * and it should not be rotated or duplicated for a one-off migration.
 * So the migration comes to the key instead of the other way round.
 *
 * Why this is not a hole in the product:
 *
 *   - Admin only, through the same allowlist the rest of /api/admin
 *     uses. A DJ's own token is not enough.
 *   - POST only, so it cannot be triggered by visiting a URL, a
 *     prefetch, a crawler or a link someone was sent.
 *   - Dry run unless the body explicitly asks otherwise, and applying
 *     needs a confirmation string as well as a flag.
 *   - It writes one column. Account ids, payout settings and Connect
 *     capabilities are never touched, and every Stripe call is a read.
 *   - It stops working on its own after the date below, so forgetting
 *     to delete it fails closed rather than leaving a live migration
 *     endpoint sitting in the product indefinitely.
 *   - The key is never read, returned or logged. Stripe's own masked
 *     form is stripped from error text before it leaves the function.
 */

/** Inert after this date. Deleting the file is still the intended end. */
const EXPIRES_AFTER = Date.parse("2026-09-30T00:00:00Z");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  if (Date.now() > EXPIRES_AFTER) {
    return NextResponse.json(
      { error: "This one-off migration endpoint has expired." },
      { status: 410 }
    );
  }

  const admin = await getAdminUser(supabaseAuth, request);

  if (!admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  let body: { apply?: unknown; confirm?: unknown } = {};

  try {
    body = await request.json();
  } catch {
    /* No body means a dry run, which is the safe default. */
  }

  /*
   * Applying takes two independent acknowledgements, so neither a typo
   * nor a replayed dry-run request can write.
   */
  const apply = body.apply === true && body.confirm === "apply-live-backfill";

  if (body.apply === true && !apply) {
    return NextResponse.json(
      {
        error:
          'To apply, send { "apply": true, "confirm": "apply-live-backfill" }.',
      },
      { status: 400 }
    );
  }

  try {
    const result = await backfillConnectStatus({
      stripe,
      supabase: supabaseAdmin,
      apply,
    });

    /* Logged so the run is recoverable from Vercel's logs if the
       response is lost. Counts only: no ids, no key, no account detail. */
    console.log(
      `[backfill-connect-status] by ${admin.email} mode=${result.mode} ` +
        `apply=${apply} ${JSON.stringify(result.summary)}`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[backfill-connect-status] failed:", error);

    return NextResponse.json(
      { error: "The backfill could not run." },
      { status: 500 }
    );
  }
}
