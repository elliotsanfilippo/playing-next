import { blockerPolicy } from "@/src/lib/crmTaxonomy";
import type {
  CrmContact,
  CrmTask,
  PipelineRow,
} from "@/src/components/admin/crmTypes";

/*
 * ── Two different questions, kept apart ───────────────────────────
 *
 * What do I need to DO?          tasks, from crm_tasks
 * What is TRUE that I should     state, from the blocker and the
 * be aware of?                   product lifecycle
 *
 * These were one blended list before, which is how "Mark done" ended up
 * offered on a row that had no task on it. A DJ can legitimately be
 * awaiting a reply AND have a task due Friday; those are two facts and
 * the interface now says so.
 *
 * Nothing here reads next_action or next_follow_up_at. Those columns
 * remain in the database as rollback data and are operationally dead.
 */

const DAY = 86_400_000;
const STALLED_AFTER_DAYS = 7;
/* Overview answers "now", so a task months away is not part of it. The
   Tasks tab shows every future task without this window. */
const OVERVIEW_UPCOMING_DAYS = 7;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayOf(value: string): number | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysBetween(a: number, b: number): number {
  return Math.round((a - b) / DAY);
}

/* ── Tasks ─────────────────────────────────────────────────────── */

export const TASK_TIERS = ["overdue", "today", "upcoming", "unscheduled"] as const;
export type TaskTier = (typeof TASK_TIERS)[number];

export const TASK_TIER_LABELS: Record<TaskTier, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  unscheduled: "Unscheduled",
};

export type TaskItem = {
  task: CrmTask;
  row: PipelineRow | null;
  tier: TaskTier;
  /** "2 days overdue", "Due today", "Due 6 Sept", "No date". */
  dueLabel: string;
  rank: number;
};

/**
 * Every tier is derived from due_at and completed_at alone. There is no
 * status column, deliberately: two fields describing one thing is how
 * they drift.
 */
export function classifyTask(task: CrmTask, today = startOfToday()): TaskTier {
  if (!task.due_at) return "unscheduled";
  const due = dayOf(task.due_at);
  if (due === null) return "unscheduled";
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

export function taskDueLabel(task: CrmTask, today = startOfToday()): string {
  if (!task.due_at) return "No date";
  const due = dayOf(task.due_at);
  if (due === null) return "No date";
  const days = daysBetween(today, due);
  if (days === 1) return "1 day overdue";
  if (days > 1) return `${days} days overdue`;
  if (days === 0) return "Due today";
  if (days === -1) return "Due tomorrow";
  return `Due ${new Date(task.due_at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })}`;
}

export function buildTaskQueue(
  tasks: CrmTask[],
  rows: PipelineRow[]
): TaskItem[] {
  const today = startOfToday();
  const byContact = new Map(
    rows.filter((r) => r.contact).map((r) => [r.contact!.id, r])
  );
  const order = new Map(TASK_TIERS.map((t, i) => [t, i]));

  return tasks
    .filter((t) => !t.completed_at)
    .map((task) => {
      const tier = classifyTask(task, today);
      const due = task.due_at ? dayOf(task.due_at) : null;
      return {
        task,
        row: byContact.get(task.contact_id) ?? null,
        tier,
        dueLabel: taskDueLabel(task, today),
        /* Most overdue first inside overdue; soonest first inside
           upcoming; newest first among unscheduled. */
        rank:
          due === null
            ? -new Date(task.created_at).getTime()
            : tier === "overdue"
              ? -daysBetween(today, due)
              : daysBetween(due, today),
      };
    })
    .sort((a, b) => {
      const tier = order.get(a.tier)! - order.get(b.tier)!;
      return tier !== 0 ? tier : a.rank - b.rank;
    });
}

/** The subset Overview shows: everything except distant future work. */
export function overviewTasks(items: TaskItem[]): TaskItem[] {
  const today = startOfToday();
  return items.filter((item) => {
    if (item.tier !== "upcoming") return true;
    const due = item.task.due_at ? dayOf(item.task.due_at) : null;
    return due !== null && daysBetween(due, today) <= OVERVIEW_UPCOMING_DAYS;
  });
}

export function countTaskTiers(items: TaskItem[]): Record<TaskTier, number> {
  const counts = Object.fromEntries(TASK_TIERS.map((t) => [t, 0])) as Record<
    TaskTier,
    number
  >;
  for (const i of items) counts[i.tier] += 1;
  return counts;
}

/* ── States ────────────────────────────────────────────────────── */

export const STATE_TIERS = ["awaiting", "stalled"] as const;
export type StateTier = (typeof STATE_TIERS)[number];

export const STATE_TIER_LABELS: Record<StateTier, string> = {
  awaiting: "Awaiting reply",
  stalled: "Onboarding stalled",
};

export type StateItem = {
  row: PipelineRow;
  tier: StateTier;
  reason: string;
  stamp: string;
  rank: number;
};

/**
 * Things that are true and worth knowing, but are not actions of mine.
 * Nothing here can be "completed"; it changes when the person or the
 * product changes, which is exactly why these are not tasks.
 */
export function buildStateQueue(rows: PipelineRow[]): StateItem[] {
  const today = startOfToday();
  const items: StateItem[] = [];

  for (const row of rows) {
    const contact = row.contact;
    const hasBlocker = !!contact?.activation_blocker;
    const policy = blockerPolicy(contact?.activation_blocker);
    const isReady = row.stage === "ready_to_activate";

    /* when_due used to mean "there is a next action recorded". With
       next_action retired, it means the person has an open task. */
    const surfaces = hasBlocker
      ? policy === "always"
      : isReady;

    if (surfaces) {
      const waited =
        contact?.last_contact_at !== undefined && contact?.last_contact_at
          ? daysBetween(today, dayOf(contact.last_contact_at) ?? today)
          : null;
      items.push({
        row,
        tier: "awaiting",
        reason: contact?.activation_blocker
          ? "Waiting on a reply from them"
          : "Ready to activate, no blocker recorded",
        stamp:
          waited === null
            ? "Not contacted"
            : waited === 0
              ? "Contacted today"
              : waited === 1
                ? "Waiting 1 day"
                : `${waited}d waiting`,
        rank: -(waited ?? 0),
      });
      continue;
    }

    if (
      row.stage === "onboarding_incomplete" &&
      row.dj &&
      !contact?.last_contact_at &&
      daysBetween(today, new Date(row.dj.created_at).getTime()) >=
        STALLED_AFTER_DAYS
    ) {
      const age = daysBetween(today, new Date(row.dj.created_at).getTime());
      items.push({
        row,
        tier: "stalled",
        reason: "Signed up and never finished setup. Never contacted.",
        stamp: `${age}d ago`,
        rank: -age,
      });
    }
  }

  const order = new Map(STATE_TIERS.map((t, i) => [t, i]));
  return items.sort((a, b) => {
    const tier = order.get(a.tier)! - order.get(b.tier)!;
    return tier !== 0 ? tier : a.rank - b.rank;
  });
}

export function countStateTiers(items: StateItem[]): Record<StateTier, number> {
  const counts = Object.fromEntries(STATE_TIERS.map((t) => [t, 0])) as Record<
    StateTier,
    number
  >;
  for (const i of items) counts[i.tier] += 1;
  return counts;
}

/* ── Contacts list ordering ────────────────────────────────────── */

const STAGE_RANK: Record<string, number> = {
  pro: 0, repeat: 1, activated: 2, ready_to_activate: 3,
  onboarded: 4, payments_ready: 5, onboarding_incomplete: 6,
  signed_up: 7, prospect: 8,
};

/**
 * Order by claim on attention: people with open tasks, then people in a
 * state worth knowing, then accounts by stage, then prospects you have
 * spoken to, then cold ones.
 */
export function sortForContacts(
  rows: PipelineRow[],
  taskItems: TaskItem[],
  stateItems: StateItem[]
): PipelineRow[] {
  const taskRank = new Map<string, number>();
  taskItems.forEach((item, i) => {
    if (item.row && !taskRank.has(item.row.key)) taskRank.set(item.row.key, i);
  });
  const statePos = new Map(stateItems.map((s, i) => [s.row.key, i]));

  const band = (row: PipelineRow) => {
    if (taskRank.has(row.key)) return 0;
    if (statePos.has(row.key)) return 1;
    if (row.dj) return 2;
    if (row.contact?.last_contact_at) return 3;
    return 4;
  };

  return [...rows].sort((a, b) => {
    const d = band(a) - band(b);
    if (d !== 0) return d;
    if (band(a) === 0) return taskRank.get(a.key)! - taskRank.get(b.key)!;
    if (band(a) === 1) return statePos.get(a.key)! - statePos.get(b.key)!;
    if (band(a) === 2) {
      const stage = (STAGE_RANK[a.stage] ?? 9) - (STAGE_RANK[b.stage] ?? 9);
      if (stage !== 0) return stage;
      return new Date(b.dj!.created_at).getTime() - new Date(a.dj!.created_at).getTime();
    }
    if (band(a) === 3) {
      return new Date(b.contact!.last_contact_at!).getTime() -
             new Date(a.contact!.last_contact_at!).getTime();
    }
    return new Date(b.contact?.created_at ?? 0).getTime() -
           new Date(a.contact?.created_at ?? 0).getTime();
  });
}
