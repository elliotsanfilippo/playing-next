"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Pencil, RotateCcw } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import {
  buildTaskQueue,
  taskDueLabel,
  type TaskTier,
} from "@/src/lib/crmQueue";
import { rowLabel } from "@/src/lib/djIdentity";
import type { CrmTask, PipelineRow } from "@/src/components/admin/crmTypes";

/*
 * Every filter is derived from due_at and completed_at. There is no
 * status column and deliberately never will be: two fields describing
 * one thing is how they drift apart.
 *
 * "Unscheduled" earns its own filter rather than being folded into Open
 * because the five migrated tasks all live there. A task without a date
 * is not less real, and it must never be findable only by scrolling.
 */
/*
 * Every filter is derived from due_at and completed_at. There is no
 * status column and deliberately never will be: two fields describing
 * one thing is how they drift apart.
 */
const FILTERS = [
  "open",
  "overdue",
  "today",
  "upcoming",
  "unscheduled",
  "done",
] as const;
type Filter = (typeof FILTERS)[number];

/*
 * "All" rather than "Open", because the heading already says how many
 * are open and a chip repeating it reads as a different number until you
 * work out that it is the same one.
 */
const FILTER_LABELS: Record<Filter, string> = {
  open: "All",
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  unscheduled: "Unscheduled",
  done: "Done",
};

/*
 * The explanatory sentence under the filters is gone. It said the same
 * thing every visit for a list whose grouping now says it structurally -
 * a heading reading "UNSCHEDULED · 4" needs no caption. The one genuinely
 * unfamiliar idea is that a task without a date is still real work, so
 * that single hint survives and only where it applies.
 */
const UNSCHEDULED_HINT =
  "No date yet. Still yours to do, and it stays here until you give it one.";

/*
 * Urgency lives in the LEFT edge only, and every edge is declared
 * explicitly so nothing can inherit a colour it was not given.
 *
 * Rows are separated by space rather than by a rule. With flush rows and
 * a divider, three consecutive Today accents met end to end and read as
 * one continuous amber line down the page instead of three tasks; the
 * gap is what makes each accent belong to its own object. It also means
 * there is no horizontal border to inherit a tier colour, which is the
 * bug that produced the amber L-shapes in the first place.
 */
const edge: Record<TaskTier, string> = {
  overdue: "border-l-status-declined",
  today: "border-l-status-pending",
  upcoming: "border-l-white/10",
  unscheduled: "border-l-white/10",
};

const dueText: Record<TaskTier, string> = {
  overdue: "text-status-declined",
  today: "text-status-pending",
  upcoming: "text-text-muted",
  unscheduled: "text-text-muted",
};

/* The order the default list groups into. Empty groups are not drawn. */
const GROUPS: TaskTier[] = ["overdue", "today", "upcoming", "unscheduled"];

const GROUP_LABELS: Record<TaskTier, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  unscheduled: "Unscheduled",
};

export default function TasksView({
  tasks,
  rows,
  onOpenContact,
  onComplete,
  onReopen,
  onReschedule,
}: {
  tasks: CrmTask[];
  rows: PipelineRow[];
  onOpenContact: (key: string) => void;
  onComplete: (task: CrmTask) => void;
  onReopen: (task: CrmTask) => void;
  /*
   * One handler, because there is one sheet. Reschedule and Edit were
   * two buttons wired to the same function opening the same sheet, which
   * edits both the title and the date - so the third button cost every
   * row a second line of controls and offered nothing the second did
   * not. An overflow menu was considered and rejected for the same
   * reason: it would have held a single item duplicating the button
   * beside it, and a nested popover over a list is real complexity to
   * buy nothing.
   */
  onReschedule: (task: CrmTask) => void;
}) {
  const [filter, setFilter] = useState<Filter>("open");

  const open = useMemo(() => buildTaskQueue(tasks, rows), [tasks, rows]);
  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.completed_at)
        .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1)),
    [tasks]
  );
  const rowByContact = useMemo(
    () => new Map(rows.filter((r) => r.contact).map((r) => [r.contact!.id, r])),
    [rows]
  );

  const counts: Record<Filter, number> = {
    open: open.length,
    overdue: open.filter((t) => t.tier === "overdue").length,
    today: open.filter((t) => t.tier === "today").length,
    upcoming: open.filter((t) => t.tier === "upcoming").length,
    unscheduled: open.filter((t) => t.tier === "unscheduled").length,
    done: done.length,
  };

  const doneItems = done.map((task) => ({
    task,
    row: rowByContact.get(task.contact_id) ?? null,
    tier: "unscheduled" as TaskTier,
    dueLabel: "",
    rank: 0,
  }));

  const visible =
    filter === "done"
      ? doneItems
      : filter === "open"
        ? open
        : open.filter((t) => t.tier === filter);

  /*
   * Grouped only on the unfiltered list. A filter has already narrowed
   * to one tier, so a heading naming that tier would repeat the chip you
   * just pressed.
   */
  const grouped = filter === "open";

  const renderRow = (item: (typeof open)[number]) => {
    const completed = !!item.task.completed_at;
    const contact = item.row ? rowLabel(item.row) : "Contact removed";
    const due = completed
      ? `Completed ${new Date(item.task.completed_at!).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
      : item.tier === "unscheduled"
        ? "No due date"
        : taskDueLabel(item.task);

    return (
      <li
        key={item.task.id}
        className={`rounded-control border-l-2 p-3.5 ${
          completed
            ? "border-l-white/10 bg-white/[0.015] opacity-60"
            : `bg-white/[0.03] ${edge[item.tier]}`
        }`}
      >
        <button
          type="button"
          onClick={() => item.row && onOpenContact(item.row.key)}
          disabled={!item.row}
          /* The row-opening target. Full width, but a single-line title
             left it 40px tall, so it carries its own minimum. */
          className="flex min-h-[44px] w-full flex-col justify-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span
            className={`block font-semibold ${completed ? "text-text-muted line-through" : "text-white"}`}
          >
            {item.task.title}
          </span>
          {/*
            Contact and due state share one line. They were two, which
            cost every row a whole line to say two short things that are
            read together anyway.
          */}
          <span className="mt-0.5 block truncate font-mono text-xs text-text-muted">
            {contact}
            <span aria-hidden> · </span>
            <span className={completed ? "text-text-muted" : dueText[item.tier]}>
              {due}
            </span>
          </span>
        </button>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {completed ? (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
              onClick={() => onReopen(item.task)}
            >
              <RotateCcw size={14} className="mr-1.5" />
              Reopen
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="min-h-[44px]"
                onClick={() => onComplete(item.task)}
              >
                <Check size={14} className="mr-1.5" />
                Complete
              </Button>
              {/*
                Named for what it does to THIS task. The sheet edits the
                title and the date together, so "Edit" is the honest name
                for a dated task - "Reschedule" promised only half of it.
                An undated task keeps "Schedule", because giving a task
                its first date is a distinct and useful thing to be
                offered, not a correction. Same sheet either way, same
                Today / Tomorrow / Next week / Pick date / Unscheduled
                choices.
              */}
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px]"
                onClick={() => onReschedule(item.task)}
              >
                {/* A clock for giving a date, a pencil for editing one
                    that exists. Same button, same sheet; the icon just
                    stops promising the wrong half of it. */}
                {item.tier === "unscheduled" ? (
                  <Clock size={14} className="mr-1.5" />
                ) : (
                  <Pencil size={14} className="mr-1.5" />
                )}
                {item.tier === "unscheduled" ? "Schedule" : "Edit"}
              </Button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="space-y-2.5 border-b border-white/5 p-4">
        <h2 className="text-h3">
          Tasks{" "}
          <span className="font-mono text-sm text-text-muted">
            {counts.open} open
          </span>
        </h2>

        {/*
          A chip only where there is something behind it. All always
          shows; the rest appear when they have a count, so the row stays
          short on an ordinary day and grows only when it has something
          to report.
        */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.filter((f) => f === "open" || counts[f] > 0).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`min-h-[44px] rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                filter === f
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-white/10 bg-white/5 text-text-muted hover:text-white"
              }`}
            >
              {FILTER_LABELS[f]}
              {f !== "open" && (
                <span className="ml-1.5 opacity-70">{counts[f]}</span>
              )}
            </button>
          ))}
        </div>

        {filter === "unscheduled" && (
          <p className="text-sm text-text-muted">{UNSCHEDULED_HINT}</p>
        )}
      </div>

      {/* pt trimmed against the header's own padding; the group heading
          below carries its own breathing room. */}
      <div className="px-4 pb-4 pt-2.5">
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">
            {filter === "open"
              ? "Nothing to do. Open a contact and add a task."
              : filter === "done"
                ? "Nothing completed yet."
                : "Nothing in this group."}
          </p>
        ) : grouped ? (
          <div className="space-y-5">
            {GROUPS.filter((g) => counts[g] > 0).map((g) => (
              <section key={g}>
                <h3 className="flex items-baseline gap-2 px-0.5 pb-2">
                  <span className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.13em] text-white">
                    {GROUP_LABELS[g]}
                  </span>
                  {/* Muted, not accent. Green means "this is selected"
                      on the filter chips and "this is the primary
                      action" on Complete; spending it on a count that is
                      neither dilutes both. */}
                  <span className="font-mono text-[0.66rem] font-bold text-text-muted">
                    {counts[g]}
                  </span>
                </h3>
                <ul className="space-y-2">
                  {open.filter((t) => t.tier === g).map(renderRow)}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">{visible.map(renderRow)}</ul>
        )}
      </div>
    </Card>
  );
}
