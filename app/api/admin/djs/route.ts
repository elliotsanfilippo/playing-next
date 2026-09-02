import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/src/lib/adminAuth";
import {
  lifecycleStats,
  resolveLifecycleStage,
  type LifecycleRequest,
} from "@/src/lib/djLifecycle";

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

const ACCEPTED_EVER_STATUSES = ["accepted", "playing_next", "played"];

/*
 * Statuses where the guest's payment was actually captured. dj_earnings
 * is populated on every request at creation time (the amount the DJ
 * *would* earn if accepted), including ones that end up declined,
 * cancelled or expired and were never charged — so summing dj_earnings
 * across every row overstates earnings badly. "disputed" is included
 * because that money was captured before the chargeback happened; the
 * actual clawback is handled separately below via chargeback_disputes.
 * "refunded" is deliberately excluded — that money went back to the
 * guest in full, so it was never really kept.
 */
const CAPTURED_STATUSES = ["accepted", "playing_next", "played", "disputed"];

type DjProfileRow = {
  id: string;
  dj_name: string;
  slug: string;
  plan: string | null;
  request_status: string;
  created_at: string;
  /* The three inputs resolveLifecycleStage needs beyond the requests
     themselves. Read here rather than derived in the browser so the
     Admin list, the funnel counts and the segments cannot disagree
     about where a DJ is. */
  onboarding_complete: boolean | null;
  stripe_connected: boolean | null;
  stripe_subscription_status: string | null;
  /* Stamped by the dj_profiles trigger on the first transition into
     each state. NULL for DJs who got there before the columns existed;
     the timeline says "before tracking began" rather than guessing. */
  onboarded_at: string | null;
  payments_ready_at: string | null;
  pro_since: string | null;
};

type SongRequestRow = {
  id: string;
  dj_profile_id: string;
  created_at: string | null;
  request_status: string;
  dj_earnings: number | null;
  reported_not_played_at: string | null;
  /* stripe_fee is written only on the capture path, so a non-null value
     is proof money actually moved. That is what makes "activated"
     honest, and it is why the funnel says 0 activated DJs rather than
     counting the 14 signups. */
  stripe_fee: number | null;
  accepted_at: string | null;
};

type ChargebackRow = {
  dj_profile_id: string;
  disputed_amount: number | null;
  deduction_status: string;
};

type NotPlayedReportRow = {
  song_request_id: string;
  resolution: string;
};

/*
 * Fetches dj_profiles, song_requests, chargeback_disputes and
 * not_played_reports separately and joins in JS, rather than relying
 * on Supabase's automatic relationship embedding (which needs formally
 * declared foreign keys) — this repo has no migration history, so
 * those FKs' existence in the live schema isn't guaranteed. Aggregating
 * in JS is fine at the current beta scale (a handful of DJs); worth
 * moving to a real SQL aggregate once request volume grows enough for
 * this to matter.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser(supabaseAuth, request);

    if (!admin) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const [
      djProfilesResult,
      songRequestsResult,
      chargebacksResult,
      reportsResult,
      lifecycleEmailsResult,
    ] =
      await Promise.all([
        supabaseAdmin
          .from("dj_profiles")
          .select("id, dj_name, slug, plan, request_status, created_at, onboarding_complete, stripe_connected, stripe_subscription_status, onboarded_at, payments_ready_at, pro_since")
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("song_requests")
          .select("id, dj_profile_id, created_at, request_status, dj_earnings, reported_not_played_at, stripe_fee, accepted_at"),
        supabaseAdmin
          .from("chargeback_disputes")
          .select("dj_profile_id, disputed_amount, deduction_status")
          .eq("source_table", "song_requests"),
        supabaseAdmin.from("not_played_reports").select("song_request_id, resolution"),
        /* Delivery history for the contact timeline. Read here rather
           than in a second request from the drawer, so a DJ's row
           arrives complete. It is never used to derive a lifecycle
           stage - see the note in crmActivity.ts. */
        supabaseAdmin
          .from("dj_lifecycle_emails")
          .select("dj_profile_id, template_key, status, attempts, created_at, sent_at, last_error_at, returned_at, return_tracked"),
      ]);

    if (djProfilesResult.error) {
      console.error("Admin DJs load error:", djProfilesResult.error);
      return NextResponse.json({ error: "Unable to load DJs." }, { status: 500 });
    }

    if (songRequestsResult.error) {
      console.error("Admin song requests load error:", songRequestsResult.error);
      return NextResponse.json({ error: "Unable to load DJs." }, { status: 500 });
    }

    if (chargebacksResult.error) {
      console.error("Admin chargebacks load error:", chargebacksResult.error);
      return NextResponse.json({ error: "Unable to load DJs." }, { status: 500 });
    }

    if (reportsResult.error) {
      console.error("Admin reports load error:", reportsResult.error);
      return NextResponse.json({ error: "Unable to load DJs." }, { status: 500 });
    }

    const djProfiles = (djProfilesResult.data ?? []) as DjProfileRow[];
    const songRequests = (songRequestsResult.data ?? []) as SongRequestRow[];
    const chargebacks = (chargebacksResult.data ?? []) as ChargebackRow[];
    const reports = (reportsResult.data ?? []) as NotPlayedReportRow[];

    const songRequestById = new Map(songRequests.map((r) => [r.id, r]));

    const requestsByDj = new Map<string, SongRequestRow[]>();
    for (const req of songRequests) {
      const existing = requestsByDj.get(req.dj_profile_id);
      if (existing) {
        existing.push(req);
      } else {
        requestsByDj.set(req.dj_profile_id, [req]);
      }
    }

    // Money actually clawed back via a bank/card chargeback.
    const deductedByDj = new Map<string, number>();
    for (const cb of chargebacks) {
      if (cb.deduction_status !== "deducted") continue;
      deductedByDj.set(
        cb.dj_profile_id,
        (deductedByDj.get(cb.dj_profile_id) ?? 0) + (cb.disputed_amount || 0)
      );
    }

    // Money owed back for a guest-reported "wasn't played" claim marked
    // refunded — not stored with its own amount, so it's looked up via
    // the original request's dj_earnings.
    const refundedByDj = new Map<string, number>();
    for (const report of reports) {
      if (report.resolution !== "refunded") continue;
      const sourceRequest = songRequestById.get(report.song_request_id);
      if (!sourceRequest) continue;
      refundedByDj.set(
        sourceRequest.dj_profile_id,
        (refundedByDj.get(sourceRequest.dj_profile_id) ?? 0) +
          (sourceRequest.dj_earnings || 0)
      );
    }

    const djs = djProfiles.map((dj) => {
      const requests = requestsByDj.get(dj.id) ?? [];

      const acceptedEver = requests.filter((r) =>
        ACCEPTED_EVER_STATUSES.includes(r.request_status)
      ).length;

      const played = requests.filter((r) => r.request_status === "played").length;
      const notPlayedReports = requests.filter((r) => r.reported_not_played_at).length;

      const capturedRequests = requests.filter((r) =>
        CAPTURED_STATUSES.includes(r.request_status)
      );

      const grossEarningsPence = capturedRequests.reduce(
        (sum, r) => sum + (r.dj_earnings || 0),
        0
      );

      const netEarningsPence =
        grossEarningsPence -
        (deductedByDj.get(dj.id) ?? 0) -
        (refundedByDj.get(dj.id) ?? 0);

      /*
       * Financial columns (dj_earnings, request_amount, etc.) were only
       * added to song_requests around 2026-08-08 and were never
       * backfilled — captured requests from before that date have
       * dj_earnings = null, even though real money was often taken (the
       * Stripe payment_intent_id is still there). Surfacing this count
       * so the earnings figure doesn't look like a complete total when
       * it may be missing real historical revenue.
       */
      const missingEarningsCount = capturedRequests.filter(
        (r) => r.dj_earnings === null
      ).length;

      /*
       * Where this DJ actually is, decided by the one module that
       * decides it. Validated against live production data on
       * 2026-08-28: 16 profiles, each resolving to exactly one stage,
       * reproducing the hand-built funnel in GROWTH_CRM.md including
       * zero activated external DJs.
       */
      const lifecycleRequests: LifecycleRequest[] = requests.map((r) => ({
        request_status: r.request_status,
        stripe_fee: r.stripe_fee,
        accepted_at: r.accepted_at,
      }));

      const profileForLifecycle = {
        id: dj.id,
        plan: dj.plan,
        stripe_subscription_status: dj.stripe_subscription_status,
        onboarding_complete: dj.onboarding_complete,
        stripe_connected: dj.stripe_connected,
      };

      const stats = lifecycleStats(profileForLifecycle, lifecycleRequests);

      /*
       * Derived product events for the contact timeline. These need no
       * stored timestamp because the requests carry their own: the
       * first request the DJ ever received, the first one where money
       * actually moved, and the second distinct night they took paid
       * requests on.
       */
      const requestDates = requests
        .map((r) => r.created_at)
        .filter((d): d is string => !!d)
        .sort();

      const paidDates = lifecycleRequests
        .filter(
          (r) =>
            r.stripe_fee !== null &&
            r.stripe_fee !== undefined &&
            r.accepted_at
        )
        .map((r) => r.accepted_at as string)
        .sort();

      const paidNights = [...new Set(paidDates.map((d) => d.slice(0, 10)))].sort();

      return {
        first_request_at: requestDates[0] ?? null,
        first_paid_at: paidDates[0] ?? null,
        repeat_night_at:
          paidNights.length >= 2
            ? paidDates.find((d) => d.slice(0, 10) === paidNights[1]) ?? null
            : null,
        onboarded_at: dj.onboarded_at,
        payments_ready_at: dj.payments_ready_at,
        pro_since: dj.pro_since,
        lifecycle_emails: (lifecycleEmailsResult.data ?? [])
          .filter((e) => e.dj_profile_id === dj.id)
          .map((e) => ({
            template_key: e.template_key,
            status: e.status,
            attempts: e.attempts,
            created_at: e.created_at,
            sent_at: e.sent_at,
            last_error_at: e.last_error_at,
            returned_at: e.returned_at,
            return_tracked: e.return_tracked,
          })),
        lifecycle_stage: resolveLifecycleStage(
          profileForLifecycle,
          lifecycleRequests
        ),
        paid_accepted_count: stats.paidAcceptedCount,
        gig_date_count: stats.gigDateCount,
        onboarding_complete: dj.onboarding_complete === true,
        stripe_connected: dj.stripe_connected === true,
        id: dj.id,
        dj_name: dj.dj_name,
        slug: dj.slug,
        plan: dj.plan,
        request_status: dj.request_status,
        created_at: dj.created_at,
        accepted_ever: acceptedEver,
        played,
        not_played_reports: notPlayedReports,
        dispute_rate: acceptedEver > 0 ? notPlayedReports / acceptedEver : 0,
        net_earnings: netEarningsPence / 100,
        missing_earnings_count: missingEarningsCount,
      };
    });

    return NextResponse.json({ djs });
  } catch (error) {
    console.error("Admin DJs route error:", error);
    return NextResponse.json({ error: "Unable to load DJs." }, { status: 500 });
  }
}
