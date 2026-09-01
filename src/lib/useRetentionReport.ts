"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch, adminJson } from "@/src/lib/adminFetch";
import type { RetentionPlan } from "@/src/lib/retention";

/*
 * ── The retention report, fetched once for two consumers ──────────
 *
 * Lifted out of RetentionPanel when the Reports accordion needed the
 * same numbers in its collapsed header. The alternative was the panel
 * telling its parent what to print, which puts the header's truth inside
 * the thing the header describes.
 *
 * Read-only. This calls a GET route that has no mutating verbs, and
 * nothing here writes anything anywhere.
 */
export type RetentionPayload = {
  executionEnabled: boolean;
  executorExists: boolean;
  plan: RetentionPlan;
  scanned: { requests: number; tips: number; reports: number };
};

export type RetentionReport = {
  data: RetentionPayload | null;
  /*
   * Distinct from "no data yet". A failed report must never render as
   * "nothing to do" - that is the difference between a clean bill of
   * health and not having taken the patient's temperature.
   */
  failed: boolean;
  loading: boolean;
  reload: () => void;
};

/** Summary for a collapsed header. Derived, never hardcoded. */
export function retentionSummary(data: RetentionPayload | null) {
  if (!data) return { dueNow: 0, dueWithin7: 0, executionEnabled: false };
  const plan = data.plan;
  const dueNow = plan.actions.length;
  const dueWithin7 = plan.notYetDue.filter(
    (n) => n.daysUntilDue >= 0 && n.daysUntilDue <= 7
  ).length;
  return { dueNow, dueWithin7, executionEnabled: data.executionEnabled };
}

export function useRetentionReport(): RetentionReport {
  const [data, setData] = useState<RetentionPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch("/api/admin/retention");
      setData(await adminJson<RetentionPayload>(response));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, failed, loading, reload };
}
