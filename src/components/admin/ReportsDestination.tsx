"use client";

import { useState } from "react";
import AccordionSection from "@/src/components/admin/AccordionSection";
import ReportsView from "@/src/components/admin/ReportsView";
import PrivacyPanel from "@/src/components/admin/PrivacyPanel";
import RetentionPanel from "@/src/components/admin/RetentionPanel";
import { useIsDesktop } from "@/src/lib/useIsDesktop";
import {
  useRetentionReport,
  retentionSummary,
} from "@/src/lib/useRetentionReport";
import type { Report, PipelineRow } from "@/src/components/admin/crmTypes";

/*
 * ── Reports as three headlines ────────────────────────────────────
 *
 * Measured before this change: 273 + 529 + 922 = 1724px across three
 * always-open sections, which is 2.3 screens of scrolling to learn that
 * nothing needs doing. Now each section collapses to a header carrying
 * its own answer, and the detail - R1 to R4, the classifications, the
 * upcoming thresholds, the lookup, the verification steps, the
 * execution-disabled notice - all still exists, one tap away.
 *
 * ── When a section opens itself ───────────────────────────────────
 *
 * Sparingly, and only for something that wants doing:
 *
 *   Not Played Reports   opens when a report is awaiting a decision.
 *                        Each one is money owed back or a claim to deny.
 *
 *   Data retention       opens ONLY when the report failed to load. A
 *                        compliance panel that silently shows nothing is
 *                        worse than one that shouts. It deliberately does
 *                        NOT open because rows became eligible: nothing
 *                        can act on them, execution is disabled, and
 *                        opening it would imply an action that does not
 *                        exist. The count in the header is enough.
 *
 *   Privacy requests     never opens itself. "Erasure is disabled" is a
 *                        standing fact, not news, and a panel that opens
 *                        every visit to say so is a panel you stop
 *                        reading.
 */
export default function ReportsDestination({
  reports,
  rows,
  resolvingId,
  onResolve,
}: {
  reports: Report[];
  rows: PipelineRow[];
  resolvingId: string | null;
  onResolve: (id: string, resolution: "refunded" | "denied") => void;
}) {
  const isDesktop = useIsDesktop();
  const report = useRetentionReport();
  const summary = retentionSummary(report.data);

  const pending = reports.filter((r) => r.resolution === "pending").length;

  /*
   * Computed once, on mount. Not derived on every render: the retention
   * report arrives asynchronously and would otherwise pop a section open
   * under the reader a second after they arrived.
   */
  const [open, setOpen] = useState<Set<string>>(() =>
    pending > 0 ? new Set(["not-played"]) : new Set()
  );

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      /* One at a time on a phone, where a second open section pushes the
         first off screen. A desktop column has room for two, same rule as
         Overview so the two destinations do not behave differently. */
      if (!isDesktop) next.clear();
      next.add(id);
      return next;
    });

  const isOpen = (id: string) => open.has(id);

  const retentionMeta = report.failed
    ? "Report unavailable"
    : !report.data
      ? "Loading..."
      : `${summary.dueNow} due now · ${summary.dueWithin7} due within 7 days`;

  return (
    <div className="flex flex-col gap-6">
      <AccordionSection
        id="not-played"
        title="Not Played Reports"
        meta={pending > 0 ? `${pending} awaiting a decision` : "Nothing outstanding"}
        metaTone={pending > 0 ? "attention" : "muted"}
        open={isOpen("not-played")}
        onToggle={toggle}
      >
        <ReportsView
          reports={reports}
          resolvingId={resolvingId}
          onResolve={onResolve}
        />
      </AccordionSection>

      <AccordionSection
        id="privacy"
        title="Privacy requests"
        meta="Erasure disabled"
        open={isOpen("privacy")}
        onToggle={toggle}
      >
        <PrivacyPanel rows={rows} />
      </AccordionSection>

      <AccordionSection
        id="retention"
        title="Data retention"
        meta={retentionMeta}
        metaTone={report.failed ? "attention" : "muted"}
        open={isOpen("retention")}
        onToggle={toggle}
      >
        <RetentionPanel report={report} />
      </AccordionSection>
    </div>
  );
}
