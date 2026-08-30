/*
 * ── One scheduling model, everywhere a task gets a date ───────────
 *
 * Four places could set a due date and three of them disagreed: + Task
 * offered none at all, Edit offered none, Reschedule was hard-coded to
 * a week, and only the log form had a real picker. Same concept, four
 * behaviours.
 *
 * Everything now resolves through this module, so the choices cannot
 * drift apart again. 9am local is the anchor for every relative option:
 * a task due "tomorrow" should be due at the start of the working day,
 * not at whatever time you happened to create it.
 */

export type TaskDateOption =
  | "today"
  | "tomorrow"
  | "next_week"
  | "pick"
  | "none";

export const TASK_DATE_OPTIONS: { key: TaskDateOption; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "next_week", label: "Next week" },
  { key: "pick", label: "Pick date" },
  { key: "none", label: "Unscheduled" },
];

const WORKING_HOUR = 9;

function atWorkingHour(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(WORKING_HOUR, 0, 0, 0);
  return d.toISOString();
}

/**
 * Turn a choice into what goes in the database.
 *
 * "pick" needs the YYYY-MM-DD the date input produced; it is passed
 * through as-is so Postgres does the parsing rather than this doing
 * arithmetic on a string.
 */
export function resolveTaskDate(
  option: TaskDateOption,
  picked?: string
): string | null {
  switch (option) {
    case "today":
      return atWorkingHour(0);
    case "tomorrow":
      return atWorkingHour(1);
    case "next_week":
      return atWorkingHour(7);
    case "pick":
      return picked ? picked : null;
    case "none":
      return null;
  }
}

/** The YYYY-MM-DD a date input needs, from a stored timestamp. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * Which option an existing task's date corresponds to, so opening an
 * editor shows the current state selected rather than a blank slate.
 */
export function optionForDate(value: string | null | undefined): TaskDateOption {
  if (!value) return "none";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "none";

  const startOf = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const today = startOf(new Date());
  const days = Math.round((startOf(due) - today) / 86_400_000);

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === 7) return "next_week";
  return "pick";
}

/** Human description of a stored due date, for showing current state. */
export function describeDue(value: string | null | undefined): string {
  if (!value) return "Unscheduled";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "Unscheduled";

  const startOf = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const days = Math.round((startOf(due) - startOf(new Date())) / 86_400_000);

  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < -1) return `${Math.abs(days)} days overdue`;
  return `Due ${due.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year:
      due.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  })}`;
}
