import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin, serverError } from "@/src/lib/adminApi";
import { buildRetentionPlan } from "@/src/lib/retention";
import { RETENTION_EXECUTION_ENABLED } from "@/src/lib/retentionConfig";

/*
 * ── The retention report. GET only, and only ever GET ─────────────
 *
 * This route exists to answer "what would the retention rules do", and
 * it is deliberately incapable of doing any of it. There is no POST, no
 * PATCH and no DELETE handler in this file, so the route cannot mutate
 * anything even if something called it with a different verb - Next
 * returns 405 for a method with no exported handler.
 *
 * That is the report-only guarantee expressed structurally rather than
 * as a flag. The flag exists too, in retentionConfig, and is reported
 * below so the Admin can state plainly whether execution is armed. As of
 * 2026-08-31 no executor exists for it to arm.
 *
 * The response carries row IDs, classifications and FIELD NAMES. It
 * never returns the message text, the report reason, or any other
 * personal data - a compliance report that leaked the data it proposes
 * to erase would be its own kind of joke.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const [requestsResult, tipsResult, reportsResult] = await Promise.all([
      supabaseAdmin
        .from("song_requests")
        .select(
          "id, request_status, message, created_at, stripe_payment_intent_id, stripe_checkout_session_id, stripe_fee, reported_not_played_at"
        ),
      supabaseAdmin
        .from("tips")
        .select(
          "id, status, message, created_at, stripe_payment_intent_id, stripe_checkout_session_id, stripe_fee"
        ),
      supabaseAdmin
        .from("not_played_reports")
        .select("id, song_request_id, reason, resolution, created_at"),
    ]);

    /*
     * A failed load must not render as "nothing to do". An empty plan
     * and a plan we could not compute are different answers, and the
     * second one must never be mistaken for a clean bill of health.
     */
    if (requestsResult.error) {
      return serverError("Retention: requests load error:", requestsResult.error);
    }
    if (tipsResult.error) {
      return serverError("Retention: tips load error:", tipsResult.error);
    }
    if (reportsResult.error) {
      return serverError("Retention: reports load error:", reportsResult.error);
    }

    const reports = reportsResult.data ?? [];
    const reportedRequestIds = new Set<string>(
      reports.map((r) => r.song_request_id as string)
    );

    const plan = buildRetentionPlan({
      requests: (requestsResult.data ?? []) as never,
      tips: (tipsResult.data ?? []) as never,
      reports: reports as never,
      reportedRequestIds,
    });

    return NextResponse.json({
      executionEnabled: RETENTION_EXECUTION_ENABLED,
      executorExists: false,
      plan,
      scanned: {
        requests: requestsResult.data?.length ?? 0,
        tips: tipsResult.data?.length ?? 0,
        reports: reports.length,
      },
    });
  } catch (error) {
    return serverError("Retention report error:", error);
  }
}
