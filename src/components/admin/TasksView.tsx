"use client";

import { useMemo, useState } from "react";
import { Check, Clock, RotateCcw, Pencil } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import {
  buildTaskQueue,
  classifyTask,
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
const FILTERS = [
  "open",
  "overdue",
  "today",
  "upcoming",
  "unscheduled",
  "done",
] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  open: "Open",
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  unscheduled: "Unscheduled",
  done: "Done",
};

const FILTER_HINTS: Record<Filter, string> = {
  open: "Everything still to do, dated or not.",
  overdue: "Was due before today.",
  today: "Due today.",
  upcoming: "Due after today.",
  unscheduled: "No date yet. Still yours to do.",
  done: "Completed. Kept as history.",
};

/*
 * Urgency lives in the LEFT edge only.
 *
 * These used to be `border-status-pending` and friends, which set border
 * colour on all four sides. Tailwind's `divide-y` draws the separator
 * between rows as a bottom border, so it inherited that colour: three
 * consecutive Today tasks rendered as three amber L-shapes, amber down
 * the left and amber along the bottom, which is what read as unfinished.
 *
 * It broke the neutral rows too, in the other direction. `border-
 * transparent` made their separator transparent, so upcoming and
 * unscheduled rows had no divider at all while urgent ones had a
 * coloured one. Measured on Production at the stacked-Today state.
 *
 * Naming the side keeps the separator on `divide-white/5` where it
 * belongs. Transparent rather than absent on the neutral tiers so every
 * row keeps the same 2px inset and text never shifts between them.
 */
const edge: Record<TaskTier, string> = {
  overdue: "border-l-status-declined",
  today: "border-l-status-pending",
  upcoming: "border-l-transparent",
  unscheduled: "border-l-transparent",
};

const dueText: Record<TaskTier, string> = {
  overdue: "text-status-declined",
  today: "text-status-pending",
  upcoming: "text-text-muted",
  unscheduled: "text-text-muted",
};

export default function TasksView({
  tasks,
  rows,
  onOpenContact,
  onComplete,
  onReopen,
  onReschedule,
  onEdit,
}: {
  tasks: CrmTask[];
  rows: PipelineRow[];
  onOpenContact: (key: string) => void;
  onComplete: (task: CrmTask) => void;
  onReopen: (task: CrmTask) => void;
  onReschedule: (task: CrmTask) => void;
  onEdit: (task: CrmTask) => void;
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

  const visible =
    filter === "done"
      ? done.map((task) => ({
          task,
          row: rowByContact.get(task.contact_id) ?? null,
          tier: "unscheduled" as TaskTier,
          dueLabel: "",
          rank: 0,
        }))
      : filter === "open"
        ? open
        : open.filter((t) => t.tier === filter);

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="space-y-3 border-b border-white/5 p-5">
        <h2 className="text-h3">
          Tasks <span className="text-text-muted">· {counts.open} open</span>
        </h2>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              disabled={counts[f] === 0 && f !== "open" && f !== "unscheduled"}
              /* Open and Unscheduled always render, even at zero: they
                 are the two a person needs to understand the model. */
              className={`${counts[f] === 0 && f !== "open" && f !== "unscheduled" ? "hidden md:inline-block" : ""} min-h-[44px] rounded-full border px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-35 ${
                filter === f
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-white/10 bg-white/5 text-text-muted hover:text-white"
              }`}
            >
              {FILTER_LABELS[f]} {counts[f]}
            </button>
          ))}
        </div>

        <p className="text-sm text-text-muted">{FILTER_HINTS[filter]}</p>
      </div>

      <div className="divide-y divide-white/5">
        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">
            {filter === "open"
              ? "Nothing to do. Open a contact and add a task."
              : filter === "done"
                ? "Nothing completed yet."
                : "Nothing in this group."}
          </p>
        ) : (
          visible.map((item) => {
            const completed = !!item.task.completed_at;
            return (
              <div
                key={item.task.id}
                className={`border-l-2 p-4 ${completed ? "border-l-transparent" : edge[item.tier]}`}
              >
                <button
                  type="button"
                  onClick={() => item.row && onOpenContact(item.row.key)}
                  disabled={!item.row}
                  className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <span
                    className={`block font-semibold ${completed ? "text-text-muted line-through" : "text-white"}`}
                  >
                    {item.task.title}
                  </span>
                  <span className="mt-1 block text-sm text-text-muted">
                    {item.row ? rowLabel(item.row) : "Contact removed"}
                  </span>
                  <span
                    className={`mt-1.5 block font-mono text-xs ${completed ? "text-text-muted" : dueText[item.tier]}`}
                  >
                    {completed
                      ? `Completed ${new Date(item.task.completed_at!).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                      : taskDueLabel(item.task)}
                  </span>
                </button>

                <div className="mt-3 flex flex-wrap gap-2">
                  {completed ? (
                    <Button
                      variant="secondary"
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => onReschedule(item.task)}
                      >
                        <Clock size={14} className="mr-1.5" />
                        Reschedule
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => onEdit(item.task)}
                      >
                        <Pencil size={14} className="mr-1.5" />
                        Edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

export { classifyTask };
