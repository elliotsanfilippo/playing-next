"use client";

import {
  TASK_DATE_OPTIONS,
  toDateInput,
  type TaskDateOption,
} from "@/src/lib/taskDates";

/*
 * The one due-date control. Used by + Task, Edit, Reschedule and the
 * "what next?" step of Log interaction, so those four cannot offer
 * different choices again.
 *
 * Pick date reveals the native date input rather than a custom
 * calendar: on iOS that is the system wheel, which is faster and more
 * familiar than anything worth building here.
 */
export default function TaskDateChoice({
  option,
  picked,
  onOption,
  onPicked,
  idPrefix = "task",
}: {
  option: TaskDateOption;
  picked: string;
  onOption: (option: TaskDateOption) => void;
  onPicked: (value: string) => void;
  idPrefix?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TASK_DATE_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onOption(o.key)}
            aria-pressed={option === o.key}
            className={`min-h-[44px] rounded-full border px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              option === o.key
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-white/10 bg-white/5 text-text-muted hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {option === "pick" && (
        <>
          <label
            className="mt-3 block text-sm text-zinc-300"
            htmlFor={`${idPrefix}-date`}
          >
            Choose a date
          </label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            value={toDateInput(picked)}
            onChange={(e) => onPicked(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-control border border-white/10 bg-black/30 px-3 text-base text-white outline-none focus:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/30 md:h-11 md:text-sm"
          />
        </>
      )}
    </div>
  );
}
