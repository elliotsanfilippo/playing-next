"use client";

import { useMemo, useState } from "react";
import {
  Flag,
  Check,
  Clock,
  ArrowRight,
  MessageSquarePlus,
  ChevronDown,
} from "lucide-react";
import Card from "@/src/components/ui/Card";
import { useIsDesktop } from "@/src/lib/useIsDesktop";
import Button from "@/src/components/ui/Button";
import ContactIdentity from "@/src/components/admin/ContactIdentity";
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
  rowIdentity,
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

/*
 * The same left-edge-only rule as the Tasks destination, and it has to
 * live in both places because Overview renders its own task rows rather
 * than reusing that list.
 *
 * That duplication is what made the first attempt at this look like it
 * had failed: TasksView was fixed and Overview was not, so the amber
 * horizontal line was still there on the screen the app opens on.
 *
 * All-sides colour plus a divide-y bottom border is what produced it -
 * see the longer note in TasksView. Bottom colour and left colour are
 * now separate longhands that cannot collide.
 */
const tierEdge: Record<TaskTier, string> = {
  overdue: "border-l-status-declined",
  today: "border-l-status-pending",
  upcoming: "border-l-transparent",
  unscheduled: "border-l-transparent",
};

const tierText: Record<TaskTier, string> = {
  overdue: "text-status-declined",
  today: "text-status-pending",
  upcoming: "text-text-muted",
  unscheduled: "text-text-muted",
};

/*
 * ── Every Overview section is a drawer now ────────────────────────
 *
 * Overview answers "what deserves my attention", and the honest form of
 * that answer is a list of headlines you can read in one screen, not
 * five reports stacked vertically. So each section collapses to a header
 * that carries its own answer - "Growth · 13 external · 0 activated" is
 * the whole section on most visits - and opens only when you want the
 * detail behind it.
 *
 * Controlled rather than self-managing, because the accordion needs one
 * place that knows what else is open. Open state lives in OverviewView
 * and is not persisted: Overview unmounts when you switch destination,
 * so coming back from Tasks resets to the headlines rather than
 * restoring a reading position.
 */
function Section({
  id,
  title,
  meta,
  metaTone = "muted",
  open,
  onToggle,
  className = "",
  children,
}: {
  id: string;
  title: string;
  meta: string;
  /** Amber when the header is reporting something that wants acting on. */
  metaTone?: "muted" | "attention";
  open: boolean;
  onToggle: (id: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="elevated" className={`overflow-hidden ${className}`}>
      {/*
        A button rather than <details>/<summary>. The open state is owned
        above, and a <details> element toggles itself on click before
        React hears about it, so the two disagree for a frame every time
        the accordion closes a different section.
      */}
      <h2>
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-expanded={open}
          aria-controls={`section-${id}`}
          className="flex min-h-[56px] w-full flex-wrap items-baseline gap-x-3 gap-y-1 p-5 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
        >
          <span className="text-h3">{title}</span>
          <span
            className={`font-mono text-xs ${
              metaTone === "attention" ? "text-status-pending" : "text-text-muted"
            }`}
          >
            {meta}
          </span>
          <ChevronDown
            size={16}
            aria-hidden
            className={`ml-auto shrink-0 self-center text-text-muted transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h2>
      <div id={`section-${id}`} hidden={!open} className="border-t border-white/5">
        {children}
      </div>
    </Card>
  );
}

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
  /* Row per DJ profile, so identity comes from one helper everywhere. */
  const rowsByDj = useMemo(() => {
    const map = new Map<string, PipelineRow>();
    for (const row of rows) if (row.dj) map.set(row.dj.id, row);
    return map;
  }, [rows]);

  const newThisWeek = useMemo(
    () =>
      djs.filter(
        (d) =>
          !isInternalDj(d.slug) &&
          mountedAt - new Date(d.created_at).getTime() < 7 * 86_400_000
      ),
    [djs, mountedAt]
  );

  /*
   * Signups from this week that nobody has written anything about yet -
   * the same "no crm_contact" test the New signups inbox in Contacts
   * uses. This is the one thing in either secondary section that wants
   * acting on, so it decides whether the section opens itself.
   */
  const unreconciledThisWeek = useMemo(
    () => newThisWeek.filter((d) => !rowsByDj.get(d.id)?.contact).length,
    [newThisWeek, rowsByDj]
  );

  /*
   * The accordion. Everything closed on arrival, so Overview opens as
   * five headlines rather than five reports.
   *
   * The one exception is genuine urgency: an overdue task is work that
   * should already have happened, so To do opens itself. Tasks merely
   * being due today does not qualify - that is the normal state of a
   * working day, and a section that is always open is not a section, it
   * is the page.
   */
  const isDesktop = useIsDesktop();
  const [openSections, setOpenSections] = useState<Set<string>>(() =>
    taskCounts.overdue > 0 ? new Set(["todo"]) : new Set()
  );

  const toggleSection = (id: string) =>
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      /*
       * One at a time on a phone, where a second open section pushes the
       * first off screen and you are scrolling a report again. A desktop
       * column has the room to hold two open at once, so it does.
       */
      if (!isDesktop) next.clear();
      next.add(id);
      return next;
    });

  const isOpen = (id: string) => openSections.has(id);

  const readyStep = funnel.steps.find((s) => s.key === "onboarded");
  const activatedStep = funnel.steps.find((s) => s.key === "activated");
  const maxCount = Math.max(...funnel.steps.map((s) => s.count), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1 · What I need to DO ──────────────────────────────── */}
      <Section
        id="todo"
        title="To do"
        meta={
          taskCounts.overdue > 0
            ? `${todo.length} · ${taskCounts.overdue} overdue`
            : `${todo.length}`
        }
        metaTone={taskCounts.overdue > 0 ? "attention" : "muted"}
        open={isOpen("todo")}
        onToggle={toggleSection}
      >
        <div className="space-y-3 border-b border-white/5 p-5">
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

        <div>
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
                className={`border-b border-b-white/5 border-l-2 p-4 last:border-b-0 ${tierEdge[item.tier]}`}
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
      </Section>

      {/*
        ── 2 · Business context ───────────────────────────────────
        The number the whole beta turns on, so it keeps its amber tint
        and sits second. Collapsed like everything else, because the
        figure IS the section - the header carries "0 of 4" and the body
        only explains what the two numbers mean.
      */}
      <Section
        id="bottleneck"
        title="The bottleneck"
        meta={`${activatedStep?.count ?? 0} of ${readyStep?.count ?? 0}`}
        metaTone="attention"
        className="border-status-pending-surface/25 bg-status-pending-surface/[0.05]"
        open={isOpen("bottleneck")}
        onToggle={toggleSection}
      >
        <p className="p-5 text-sm leading-relaxed text-text-muted">
          Onboarded, payments-ready DJs who have taken a paid request.
          Every technical blocker is cleared. What is missing is a gig.
        </p>
      </Section>

      {/*
        ── 3 · What is TRUE and worth knowing ─────────────────────
        Collapsed. These are states, not actions: true right now, and
        changing when the person or the product changes rather than when
        you do something. The count is the part you need on arrival; the
        thirteen names behind it are a screen and a half you asked for
        only sometimes.
      */}
      {states.length > 0 && (
        <Section
          id="worth-knowing"
          title="Worth knowing"
          meta={`${states.length}`}
          open={isOpen("worth-knowing")}
          onToggle={toggleSection}
        >
          <p className="border-b border-white/5 p-5 pt-4 text-sm text-text-muted">
            Not tasks. These are true right now, and change when the
            person or the product does.
          </p>

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
        </Section>
      )}

      {/*
        Collapsed by default. The header carries the two numbers that
        matter - how many external DJs there are and how many have ever
        taken a paid request - so the section only needs opening when you
        want the breakdown behind them.
      */}
      <Section
        id="growth"
        title="Growth"
        meta={`${funnel.total} external · ${activatedStep?.count ?? 0} activated`}
        metaTone={(activatedStep?.count ?? 0) === 0 ? "attention" : "muted"}
        open={isOpen("growth")}
        onToggle={toggleSection}
      >
        <div className="p-5">
          <p className="font-mono text-xs text-text-muted">
            {funnel.internalExcluded} internal excluded
          </p>

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

        {/*
          Flattened out of a nested <details>. Opening Growth is already
          the deliberate act; making the funnel a second disclosure
          inside it meant two taps to reach the only detail the section
          has.
        */}
        <div className="border-t border-white/5 p-5">
          <p className="mb-4 font-mono text-[0.62rem] uppercase tracking-[0.13em] text-text-muted">
            Funnel detail
          </p>
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
        </div>
      </Section>

      {/*
        Collapsed when every recent signup is already in the CRM, and
        open on arrival when one is not. An account nobody has written
        anything about is the only thing here you can act on, so it is
        the only thing that earns the screen space unasked - and the
        count says so in the header either way.
      */}
      {newThisWeek.length > 0 && (
        <Section
          id="new-signups"
          title="Signed up this week"
          meta={
            unreconciledThisWeek > 0
              ? `${newThisWeek.length} · ${unreconciledThisWeek} need CRM`
              : `${newThisWeek.length} · all in your CRM`
          }
          metaTone={unreconciledThisWeek > 0 ? "attention" : "muted"}
          open={isOpen("new-signups")}
          onToggle={toggleSection}
        >
          <ul className="divide-y divide-white/5">
            {newThisWeek.map((d) => {
              /*
                Through the row rather than the raw profile, so somebody
                who signed up this week AND is already in the CRM is
                named here exactly as they are named in Contacts and on
                their tasks. Reading dj_name and slug directly is what
                made the same person "/smithgraeme91" on one screen and
                "Sol / Graeme Smith" on another.
              */
              const row = rowsByDj.get(d.id);
              const id = rowIdentity(row ?? { dj: d });
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
        </Section>
      )}
    </div>
  );
}
