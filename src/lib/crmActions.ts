import type { CrmContact } from "@/src/components/admin/crmTypes";

/*
 * ── What the CRM's three verbs mean ───────────────────────────────
 *
 * The old model had a button called "Mark done" that wrote
 * last_contact_at and cleared a follow-up date, and never touched the
 * task on screen. For the five most important DJs it changed nothing
 * visible and nothing about whether they reappeared, because they were
 * queued by their blocker rather than by a date. Tapping it recorded
 * something untrue as well: completing a task is not contact.
 *
 * So the verbs are now separated by what they actually mean.
 *
 *   Log    something happened between us. Writes history, advances
 *          last_contact_at, and may change the blocker and the next
 *          step. The only action that ever writes last_contact_at.
 *
 *   Done   a task of mine is finished. Clears the next step and its
 *          date, and nothing else. Deliberately writes no history: 14
 *          of the 23 imported contacts carry boilerplate next actions
 *          like "Follow up", and auto-noting those would bury the real
 *          history under entries nobody wrote.
 *
 *   Later  the same task, on a different day. Moves only the date.
 */

/**
 * A next step is one object: a sentence and, optionally, a date. A date
 * with no sentence is not a next step, which is why every action below
 * gates on the text rather than the date.
 */
export function hasNextStep(contact: CrmContact | null | undefined): boolean {
  return !!contact?.next_action?.trim();
}

/**
 * Why is this person in front of me?
 *
 * "owed" means I have something to do. "waiting" means the ball is in
 * their court. The distinction decides which actions are offered, and
 * it is the reason Done stops appearing on rows where there is nothing
 * of mine to complete.
 */
export type QueueReason = "owed" | "waiting";

export function queueReason(contact: CrmContact | null | undefined): QueueReason {
  return hasNextStep(contact) ? "owed" : "waiting";
}

/** Fields Done writes. Note the absence of last_contact_at. */
export function donePatch() {
  return { next_action: null, next_follow_up_at: null };
}

/** Fields Later writes. Only the date moves. */
export function laterPatch(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return { next_follow_up_at: d.toISOString() };
}

export const LATER_OPTIONS = [
  { days: 1, label: "Tomorrow" },
  { days: 3, label: "In 3 days" },
  { days: 7, label: "Next week" },
  { days: 14, label: "In 2 weeks" },
] as const;

/** Human date for the next step's due line. */
export function dueLabel(value: string | null | undefined): {
  text: string;
  overdue: boolean;
  today: boolean;
} | null {
  if (!value) return null;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return null;

  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - due.getTime()) / 86_400_000);

  if (days > 0) {
    return { text: days === 1 ? "1 day overdue" : `${days} days overdue`, overdue: true, today: false };
  }
  if (days === 0) return { text: "Due today", overdue: false, today: true };
  if (days === -1) return { text: "Due tomorrow", overdue: false, today: false };

  return {
    text: `Due ${due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`,
    overdue: false,
    today: false,
  };
}
