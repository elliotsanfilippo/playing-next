"use client";

import { useMemo, useState } from "react";
import { Flag, Check, Clock, ArrowRight, MessageSquarePlus } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import ContactIdentity from "@/src/components/admin/ContactIdentity";
import { MoreDetails } from "@/src/components/admin/DrawerSections";
import { buildExternalFunnel } from "@/src/lib/crmFunnel";
import {
  buildTaskQueue,
  buildStateQueue,
  overviewTasks,
  countTaskTiers,
  TASK_TIERS,
  TASK_TIER_LABELS,
  type TaskTier,
} from "@/src/lib/crmQueue";
import {
  displayIdentity,
  joinedLabel,
  rowLabel,
} from "@/src/lib/djIdentity";
import { isInternalDj } from "@/src/lib/internalAccounts";
import { BLOCKER_LABELS, type ActivationBlocker } from "@/src/lib/crmTaxonomy";
import type {
  CrmTask,
  DjStat,
  PipelineRow,
  Report,
} from "@/src/components/admin/crmTypes";

const PREVIEW = 5;

const tierEdge: Record<TaskTier, string> = {
  overdue: "border-status-declined",
  today: "border-status-pending",
  upcoming: "border-transparent",
  unscheduled: "border-transparent",
};

const tierText: Record<TaskTier, string> = {
  overdue: "text-status-declined",
  today: "text-status-pending",
  upcoming: "text-text-muted",
  unscheduled: "text-text-muted",
};

export default function OverviewView({
  rows,
  djs,
  tasks,
  reports,
  onOpen,
  onCompleteTask,
  onRescheduleTask,
  onGoToTasks,
  onGoToReports,
}: {
  rows: PipelineRow[];
  djs: DjStat[];
  tasks: CrmTask[];
  reports: Report[];
  onOpen: (key: string, mode?: "detail" | "log") => void;
  onCompleteTask: (task: CrmTask) => void;
  onRescheduleTask: (task: CrmTask) => void;
  onGoToTasks: () => void;
  onGoToReports: () => void;
}) {
  const [tier, setTier] = useState<TaskTier | "all">("all");
  const [showAllStates, setShowAllStates] = useState(false);
  const [mountedAt] = useState(() => Date.now());

  const allTasks = useMemo(() => buildTaskQueue(tasks, rows), [tasks, rows]);
  const todo = useMemo(() => overviewTasks(allTasks), [allTasks]);
  const taskCounts = useMemo(() => countTaskTiers(todo), [todo]);
  const states = useMemo(() => buildStateQueue(rows), [rows]);

  const visibleTasks =
    tier === "all" ? todo : todo.filter((t) => t.tier === tier);
  const shownStates = showAllStates ? states : states.slice(0, PREVIEW);

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

  const pending = reports.filter((r) => r.resolution === "pending");
  const newThisWeek = useMemo(
    () =>
      djs.filter(
        (d) =>
          !isInternalDj(d.slug) &&
          mountedAt - new Date(d.created_at).getTime() < 7 * 86_400_000
      ),
    [djs, mountedAt]
  );

  const readyStep = funnel.steps.find((s) => s.key === "onboarded");
  const activatedStep = funnel.steps.find((s) => s.key === "activated");
  const maxCount = Math.max(...funnel.steps.map((s) => s.count), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1 · What I need to DO ──────────────────────────────── */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="space-y-3 border-b border-white/5 p-5">
          <h2 className="text-h3">
            To do <span className="text-text-muted">· {todo.length}</span>
          </h2>
          <p className="text-sm text-text-muted">
            Things you have to do. Everything else on this page is context.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTier("all")}
              aria-pressed={tier === "all"}
              className={`min-h-[44px] rounded-full border px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                tier === "all"
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-white/10 bg-white/5 text-text-muted hover:text-white"
              }`}
            >
              All {todo.length}
            </button>
            {TASK_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                aria-pressed={tier === t}
                disabled={taskCounts[t] === 0}
                /* Unscheduled always shows even at zero: the five real
                   tasks live there, and a hidden filter would make them
                   feel lost rather than simply undated. */
                className={`${taskCounts[t] === 0 && t !== "unscheduled" ? "hidden md:inline-block" : ""} min-h-[44px] rounded-full border px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-35 ${
                  tier === t
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-white/10 bg-white/5 text-text-muted hover:text-white"
                }`}
              >
                {TASK_TIER_LABELS[t]} {taskCounts[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {pending.length > 0 && (
            <button
              type="button"
              onClick={onGoToReports}
              className="flex min-h-[44px] w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
            >
              <Flag size={15} className="shrink-0 text-status-pending" />
              <span className="flex-1 text-sm text-zinc-200">
                {pending.length} not-played report
                {pending.length === 1 ? "" : "s"} awaiting a decision
              </span>
              <ArrowRight size={15} className="shrink-0 text-text-muted" />
            </button>
          )}

          {visibleTasks.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-muted">
              {todo.length === 0
                ? "Nothing to do. Open a contact to add a task."
                : "Nothing in this group."}
            </p>
          ) : (
            visibleTasks.map((item) => (
              <div
                key={item.task.id}
                className={`border-l-2 p-4 ${tierEdge[item.tier]}`}
              >
                <button
                  type="button"
                  onClick={() => item.row && onOpen(item.row.key)}
                  className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <span className="block font-semibold text-white">
                    {item.task.title}
                  </span>
                  <span className="mt-1 block text-sm text-text-muted">
                    {item.row ? rowLabel(item.row) : "Unknown contact"}
                  </span>
                  <span
                    className={`mt-1.5 block font-mono text-xs ${tierText[item.tier]}`}
                  >
                    {item.dueLabel}
                  </span>
                </button>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => onCompleteTask(item.task)}
                  >
                    <Check size={14} className="mr-1.5" />
                    Complete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => onRescheduleTask(item.task)}
                  >
                    <Clock size={14} className="mr-1.5" />
                    Reschedule
                  </Button>
                </div>
              </div>
            ))
          )}

          {allTasks.length > todo.length && (
            <button
              type="button"
              onClick={onGoToTasks}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 p-4 text-sm font-semibold text-accent transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
            >
              All {allTasks.length} tasks
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </Card>

      {/* ── 2 · What is TRUE and worth knowing ─────────────────── */}
      {states.length > 0 && (
        <Card variant="elevated" className="overflow-hidden">
          <div className="border-b border-white/5 p-5">
            <h2 className="text-h3">
              Worth knowing <span className="text-text-muted">· {states.length}</span>
            </h2>
            <p className="mt-1.5 text-sm text-text-muted">
              Not tasks. These are true right now, and change when the
              person or the product does.
            </p>
          </div>

          <div className="divide-y divide-white/5">
            {shownStates.map((item) => {
              const blocker = item.row.contact?.activation_blocker
                ? BLOCKER_LABELS[
                    item.row.contact.activation_blocker as ActivationBlocker
                  ]
                : null;
              return (
                <div key={item.row.key} className="p-4">
                  <button
                    type="button"
                    onClick={() => onOpen(item.row.key)}
                    className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <ContactIdentity row={item.row} />
                    {blocker && (
                      <span className="mt-2 block text-sm text-status-pending">
                        {blocker}
                      </span>
                    )}
                    <span className="mt-1.5 block text-sm text-text-muted">
                      {item.reason}
                    </span>
                    <span className="mt-1.5 block font-mono text-xs text-text-muted">
                      {item.stamp}
                    </span>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => onOpen(item.row.key, "log")}
                      disabled={!item.row.contact}
                    >
                      <MessageSquarePlus size={14} className="mr-1.5" />
                      Log
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => onOpen(item.row.key)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              );
            })}

            {states.length > shownStates.length && (
              <button
                type="button"
                onClick={() => setShowAllStates(true)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 p-4 text-sm font-semibold text-accent transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
              >
                View all {states.length}
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ── 3 · Business context ───────────────────────────────── */}
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

      <Card variant="elevated" className="overflow-hidden">
        <div className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h3">Growth</h2>
            <p className="font-mono text-xs text-text-muted">
              {funnel.total} external · {funnel.internalExcluded} internal
              excluded
            </p>
          </div>

          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {funnel.steps.map((step) => (
              <div key={step.key} className="flex items-baseline gap-1.5">
                <dt className="sr-only">{step.label}</dt>
                <dd
                  className={`font-mono text-lg font-bold ${step.count === 0 ? "text-status-declined" : "text-white"}`}
                >
                  {step.count}
                </dd>
                <span className="text-sm text-text-muted">{step.label}</span>
              </div>
            ))}
          </dl>

          <p className="mt-3">
            <span className="inline-block rounded-full border border-status-pending-surface/25 bg-status-pending-surface/10 px-3 py-1 text-xs font-semibold text-status-pending">
              {funnel.paymentsReadyTotal} payments connected
            </span>
          </p>

          {funnel.paymentsReadyButNotOnboarded.length > 0 && (
            <p className="mt-3 text-sm text-zinc-300">
              {funnel.paymentsReadyButNotOnboarded.length} connected payments
              but never finished onboarding, which makes them the closest
              people to a first paid request.
            </p>
          )}
        </div>

        <MoreDetails title="Funnel detail">
          <ol className="space-y-3">
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
                          {step.lostFromPrevious} lost
                        </p>
                      )}
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className={`h-full rounded-full ${zero ? "bg-status-declined/40" : "bg-white/25"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {step.definition}
                  </p>
                </li>
              );
            })}
          </ol>
        </MoreDetails>
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
                    className="flex min-h-[44px] w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate font-semibold text-white ${id.isSlug ? "font-mono text-sm" : ""}`}
                      >
                        {id.primary}
                      </span>
                      <span className="block font-mono text-xs text-text-muted">
                        joined {joinedLabel(d.created_at)} ·{" "}
                        {d.onboarding_complete ? "onboarded" : "not onboarded"}
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
