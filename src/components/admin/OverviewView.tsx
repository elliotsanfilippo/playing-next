"use client";

import { useMemo, useState } from "react";
import { Flag, Check, Clock, ArrowRight } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { buildExternalFunnel } from "@/src/lib/crmFunnel";
import {
  buildQueue,
  countByTier,
  QUEUE_TIERS,
  TIER_LABELS,
  type QueueTier,
} from "@/src/lib/crmQueue";
import { displayIdentity, joinedLabel } from "@/src/lib/djIdentity";
import { isInternalDj } from "@/src/lib/internalAccounts";
import type { DjStat, PipelineRow, Report } from "@/src/components/admin/crmTypes";

const tierTone: Record<QueueTier, string> = {
  overdue:
    "border-status-declined-surface/25 bg-status-declined-surface/[0.07]",
  today: "border-status-pending-surface/25 bg-status-pending-surface/[0.07]",
  upcoming: "border-white/5 bg-white/[0.02]",
  attention: "border-status-playing-surface/25 bg-status-playing-surface/[0.06]",
  stalled: "border-white/5 bg-white/[0.02]",
};

const stampTone: Record<QueueTier, string> = {
  overdue: "text-status-declined",
  today: "text-status-pending",
  upcoming: "text-text-muted",
  attention: "text-status-playing",
  stalled: "text-text-muted",
};

export default function OverviewView({
  rows,
  djs,
  reports,
  onOpen,
  onMarkDone,
  onSnooze,
  onGoToReports,
}: {
  rows: PipelineRow[];
  djs: DjStat[];
  reports: Report[];
  onOpen: (key: string) => void;
  onMarkDone: (row: PipelineRow) => void;
  onSnooze: (row: PipelineRow, days: number) => void;
  onGoToReports: () => void;
}) {
  const [tier, setTier] = useState<QueueTier | "all">("all");
  /* Captured once per mount rather than read during render: a clock read
     in the render body gives a different answer on every re-render, so
     "this week" could silently change while nothing else did. */
  const [mountedAt] = useState(() => Date.now());

  const funnel = useMemo(
    () =>
      buildExternalFunnel(
        djs.map((d) => ({
          id: d.id,
          slug: d.slug,
          onboarding_complete: d.onboarding_complete,
          stripe_connected: d.stripe_connected,
          paid_accepted_count: d.paid_accepted_count,
          gig_date_count: d.gig_date_count,
        }))
      ),
    [djs]
  );

  const queue = useMemo(() => buildQueue(rows), [rows]);
  const counts = useMemo(() => countByTier(queue), [queue]);
  const visible = tier === "all" ? queue : queue.filter((q) => q.tier === tier);

  const pending = reports.filter((r) => r.resolution === "pending");

  const newThisWeek = useMemo(() => djs.filter(
    (d) =>
      !isInternalDj(d.slug) &&
      mountedAt - new Date(d.created_at).getTime() < 7 * 86_400_000
  ), [djs, mountedAt]);

  /* The activation step, pulled out so the headline can name it. */
  const readyStep = funnel.steps.find((s) => s.key === "onboarded");
  const activatedStep = funnel.steps.find((s) => s.key === "activated");
  const maxCount = Math.max(...funnel.steps.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[2.2fr_1fr_1fr]">
        <Card
          variant="elevated"
          className="border-status-pending-surface/25 bg-status-pending-surface/[0.05] p-5"
        >
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-text-muted">
            The bottleneck
          </p>
          <p className="mt-2 text-h2 text-status-pending">
            {activatedStep?.count ?? 0} of {readyStep?.count ?? 0}
          </p>
          <p className="mt-1.5 text-sm text-text-muted">
            DJs who finished onboarding have taken a paid request. Every
            technical blocker is cleared. What is missing is a gig.
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-text-muted">Needs you</p>
          <p className="mt-2 text-2xl font-bold">{queue.length}</p>
          <p className="mt-1 text-xs text-text-muted">
            {counts.overdue > 0 ? (
              <span className="text-status-declined">
                {counts.overdue} overdue
              </span>
            ) : (
              "nothing overdue"
            )}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-text-muted">New this week</p>
          <p className="mt-2 text-2xl font-bold">{newThisWeek.length}</p>
          <p className="mt-1 text-xs text-text-muted">
            {newThisWeek.filter((d) => !d.onboarding_complete).length} not
            onboarded
          </p>
        </Card>
      </div>

      <Card variant="elevated" className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-h3">External funnel</h2>
          <p className="font-mono text-xs text-text-muted">
            {funnel.total} external accounts · {funnel.internalExcluded} internal
            excluded
          </p>
        </div>

        {/*
          Each step is a strict subset of the one above it, so the shape
          is a real funnel rather than five unrelated counts drawn in a
          row. Payments-ready is reported underneath instead of as a step,
          because it is NOT a subset - see src/lib/crmFunnel.ts.
        */}
        <ol className="mt-5 space-y-2.5">
          {funnel.steps.map((step, index) => {
            const width = Math.max((step.count / maxCount) * 100, 2);
            const zero = step.count === 0;
            return (
              <li key={step.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-zinc-200">
                    <span
                      className={`font-mono text-base font-bold ${zero ? "text-status-declined" : "text-white"}`}
                    >
                      {step.count}
                    </span>{" "}
                    {index === 0 ? "external DJs" : "of them"} {step.label}
                  </p>
                  {step.lostFromPrevious !== null &&
                    step.lostFromPrevious > 0 && (
                      <p className="shrink-0 font-mono text-xs text-status-declined">
                        {step.lostFromPrevious} lost here
                      </p>
                    )}
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className={`h-full rounded-full ${zero ? "bg-status-declined/40" : "bg-accent/70"}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-text-muted">{step.definition}</p>
              </li>
            );
          })}
        </ol>

        {funnel.paymentsReadyButNotOnboarded.length > 0 && (
          <p className="mt-5 rounded-control border border-status-pending-surface/20 bg-status-pending-surface/[0.07] p-3 text-sm text-zinc-200">
            <strong className="text-status-pending">
              {funnel.paymentsReadyTotal} connected payments
            </strong>
            , but {funnel.paymentsReadyButNotOnboarded.length} of them never
            finished onboarding. They handed over bank details and then stopped,
            which makes them the closest people in the pipeline to a first paid
            request.
          </p>
        )}
      </Card>

      <Card variant="elevated" className="overflow-hidden">
        <div className="space-y-3 border-b border-white/5 p-5">
          <h2 className="text-h3">Needs you</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTier("all")}
              aria-pressed={tier === "all"}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                tier === "all"
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-white/10 bg-white/5 text-text-muted hover:text-white"
              }`}
            >
              All {queue.length}
            </button>
            {QUEUE_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                aria-pressed={tier === t}
                disabled={counts[t] === 0}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-35 ${
                  tier === t
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-white/10 bg-white/5 text-text-muted hover:text-white"
                }`}
              >
                {TIER_LABELS[t]} {counts[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {pending.length > 0 && (
            <button
              type="button"
              onClick={onGoToReports}
              className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
            >
              <Flag size={15} className="shrink-0 text-status-pending" />
              <span className="flex-1 text-sm text-zinc-200">
                {pending.length} not-played report
                {pending.length === 1 ? "" : "s"} awaiting a decision
              </span>
              <ArrowRight size={15} className="shrink-0 text-text-muted" />
            </button>
          )}

          {visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-muted">
              {queue.length === 0
                ? "Nothing waiting. No follow-ups due, no gigs this week, nobody stalled."
                : "Nothing in this group."}
            </p>
          ) : (
            visible.map((item) => {
              const id = displayIdentity(
                item.row.dj?.dj_name ?? item.row.name,
                item.row.dj?.slug
              );
              return (
                <div
                  key={item.row.key}
                  className={`flex flex-col gap-3 border-l-2 p-4 sm:flex-row sm:items-center ${tierTone[item.tier]}`}
                >
                  <span
                    className={`shrink-0 font-mono text-xs sm:w-20 ${stampTone[item.tier]}`}
                  >
                    {item.stamp}
                  </span>

                  <button
                    type="button"
                    onClick={() => onOpen(item.row.key)}
                    className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <span
                      className={`block truncate font-semibold text-white ${id.isSlug ? "font-mono text-sm" : ""}`}
                    >
                      {id.primary}
                    </span>
                    <span className="block truncate text-sm text-text-muted">
                      {item.reason}
                    </span>
                  </button>

                  <span className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onMarkDone(item.row)}
                      disabled={!item.row.contact}
                      title={
                        item.row.contact
                          ? "Mark done"
                          : "Add CRM context first"
                      }
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onSnooze(item.row, 7)}
                      disabled={!item.row.contact}
                      title="Snooze a week"
                    >
                      <Clock size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpen(item.row.key)}
                    >
                      Open
                    </Button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {newThisWeek.length > 0 && (
        <Card variant="elevated" className="overflow-hidden">
          <div className="border-b border-white/5 p-5">
            <h2 className="text-h3">Signed up this week</h2>
          </div>
          <ul className="divide-y divide-white/5">
            {newThisWeek.map((d) => {
              const id = displayIdentity(d.dj_name, d.slug);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(`dj:${d.id}`)}
                    className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate font-semibold text-white ${id.isSlug ? "font-mono text-sm" : ""}`}
                      >
                        {id.primary}
                      </span>
                      <span className="block font-mono text-xs text-text-muted">
                        joined {joinedLabel(d.created_at)} ·{" "}
                        {d.onboarding_complete
                          ? "onboarded"
                          : "not onboarded"}
                      </span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
