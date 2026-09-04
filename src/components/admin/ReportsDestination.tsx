"use client";

import { useState } from "react";
import AccordionSection from "@/src/components/admin/AccordionSection";
import ReportsView from "@/src/components/admin/ReportsView";
import PrivacyPanel from "@/src/components/admin/PrivacyPanel";
import RemindersPanel from "@/src/components/admin/RemindersPanel";
import { reminderMeta, summariseReminders } from "@/src/lib/lifecycleEmailSummary";
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
  const reminders = summariseReminders(rows);
  const remindersMeta = reminderMeta(reminders);

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

  /*
   * "Eligible", not "due". Due reads as a task with a deadline someone is
   * expected to meet; nothing here is anyone's to do, because execution
   * is deliberately disabled. Eligible says what is true - these rows now
   * meet the rule's age condition - without implying an action.
   */
  const retentionMeta = report.failed
    ? "Report unavailable"
    : !report.data
      ? "Loading..."
      : `${summary.dueNow} eligible now · ${summary.dueWithin7} within 7 days`;

  /*
   * Kept in the collapsed state rather than only inside the section: it
   * is the fact that makes the counts above safe to read calmly, and a
   * reader deciding whether to open this should have it first.
   */
  const retentionSubMeta = report.data
    ? summary.executionEnabled
      ? "Execution ENABLED"
      : "Report only · execution disabled"
    : undefined;

  /*
    ── Two bands, not four peers ─────────────────────────────────
    Audited 2026-09-04: this destination held four unrelated things at
    identical visual weight, and only one of them is a report. Not
    Played Reports is a money decision that can be outstanding; the
    other three are standing records that never wait on anybody.

    Nothing moves destination and nothing is deleted - the grouping was
    always true, it just was not drawn. The stronger fix is to send Not
    Played to the task queue and Setup reminders to Growth, leaving a
    genuine Compliance section, but that moves where work is done and is
    a workflow change rather than presentation.
  */
  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <h2 className="px-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-muted">
          Needs a decision
        </h2>

        <AccordionSection
          id="not-played"
          title="Not Played Reports"
          headingLevel={3}
          meta={
            pending > 0
              ? `${pending} awaiting a decision`
              : "Nothing outstanding"
          }
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
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex flex-wrap items-baseline gap-x-2 px-1">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-muted">
            Standing records
          </span>
          <span className="text-xs text-text-muted">
            nothing here is waiting on you
          </span>
        </h2>

        {remindersMeta && (
          <AccordionSection
            id="reminders"
            title="Setup reminders"
            headingLevel={3}
            meta={remindersMeta}
            open={isOpen("reminders")}
            onToggle={toggle}
          >
            <RemindersPanel summary={reminders} />
          </AccordionSection>
        )}

        <AccordionSection
          id="privacy"
          title="Privacy requests"
          headingLevel={3}
          meta="Erasure disabled · lookup and export available"
          open={isOpen("privacy")}
          onToggle={toggle}
        >
          <PrivacyPanel rows={rows} />
        </AccordionSection>

        <AccordionSection
          id="retention"
          title="Data retention"
          headingLevel={3}
          meta={retentionMeta}
          subMeta={retentionSubMeta}
          metaTone={report.failed ? "attention" : "muted"}
          open={isOpen("retention")}
          onToggle={toggle}
        >
          <RetentionPanel report={report} />
        </AccordionSection>
      </section>
    </div>
  );
}
