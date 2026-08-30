"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Button from "@/src/components/ui/Button";
import TaskDateChoice from "@/src/components/admin/TaskDateChoice";
import { useModalA11y } from "@/src/lib/useModalA11y";
import { useVisualViewport } from "@/src/lib/useVisualViewport";
import {
  resolveTaskDate,
  optionForDate,
  toDateInput,
  describeDue,
  type TaskDateOption,
} from "@/src/lib/taskDates";
import type { CrmTask } from "@/src/components/admin/crmTypes";

/*
 * One sheet for creating, editing and rescheduling. Reschedule is not a
 * separate concept - it is this sheet opened on an existing task - which
 * is how the four flows stay identical rather than merely similar.
 */
export default function TaskSheet({
  task,
  contactName,
  saving,
  onClose,
  onSave,
}: {
  /** Null when creating. */
  task: CrmTask | null;
  contactName: string;
  saving: boolean;
  onClose: () => void;
  onSave: (title: string, dueAt: string | null) => void;
}) {
  const { dialogProps } = useModalA11y({ open: true, onClose });
  const viewport = useVisualViewport();

  const [title, setTitle] = useState(task?.title ?? "");
  const [option, setOption] = useState<TaskDateOption>(
    task ? optionForDate(task.due_at) : "none"
  );
  const [picked, setPicked] = useState(toDateInput(task?.due_at));

  const editing = !!task;

  return (
    <div
      className="fixed inset-x-0 z-[60] flex items-end justify-center sm:items-center"
      style={{
        top: viewport.height ? `${viewport.offsetTop}px` : 0,
        height: viewport.height ? `${viewport.height}px` : "100dvh",
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        {...dialogProps("task-sheet-title")}
        className="relative flex max-h-full w-full max-w-md flex-col overflow-y-auto rounded-t-card border border-white/10 bg-surface-base shadow-2xl shadow-black/60 sm:rounded-card"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/5 p-5">
          <div className="min-w-0">
            <h2 id="task-sheet-title" className="text-h3">
              {editing ? "Edit task" : "New task"}
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-text-muted">
              {contactName}
              {editing && ` · currently ${describeDue(task.due_at).toLowerCase()}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div>
            <label className="text-sm font-semibold text-zinc-200" htmlFor="task-title">
              What do you need to do?
            </label>
            <input
              id="task-title"
              /* See useModalA11y: React would apply autoFocus before the
                 dialog hook records where focus came from. */
              data-autofocus={!editing ? "" : undefined}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ask Cammy how Saturday went"
              className="mt-2 h-12 w-full rounded-control border border-white/10 bg-black/30 px-3 text-base text-white outline-none placeholder:text-zinc-600 focus:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/30 md:h-11 md:text-sm"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-200">When</p>
            <p className="mt-1 text-xs text-text-muted">
              Unscheduled is fine. A task without a date is still yours to
              do and stays in its own filter.
            </p>
            <div className="mt-2.5">
              <TaskDateChoice
                option={option}
                picked={picked}
                onOption={setOption}
                onPicked={setPicked}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="accent"
              className="min-h-[44px] flex-1"
              disabled={saving || !title.trim()}
              onClick={() => onSave(title, resolveTaskDate(option, picked))}
            >
              {saving ? "Saving..." : editing ? "Save task" : "Add task"}
            </Button>
            <Button variant="ghost" className="min-h-[44px]" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
