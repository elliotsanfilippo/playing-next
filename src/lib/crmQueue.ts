import type { CrmContact, PipelineRow } from "@/src/components/admin/crmTypes";

/*
 * ── What needs doing, in the order it needs doing ─────────────────
 *
 * The previous version listed whatever matched, in row order, which put
 * a gig three days away above a follow-up two days overdue. Ordering by
 * a sort key alone would fix today's symptom and break again the next
 * time a reason is added, so urgency is expressed as tiers: a lower
 * tier can never outrank a higher one whatever its date.
 *
 * Tier 5, onboarding stalled, is the one that surfaces the nine people
 * who signed up and vanished. Nothing in the Admin used to say anything
 * about them at all.
 */
export const QUEUE_TIERS = [
  "overdue",
  "today",
  "upcoming",
  "ready",
  "stalled",
] as const;

export type QueueTier = (typeof QUEUE_TIERS)[number];

export const TIER_LABELS: Record<QueueTier, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  ready: "Ready to activate",
  stalled: "Onboarding stalled",
};

export type QueueItem = {
  row: PipelineRow;
  tier: QueueTier;
  /** Plain sentence saying why this is here. */
  reason: string;
  /** Short right-aligned stamp: "3d late", "Today", "Sat 6 Sep". */
  stamp: string;
  /** Sort key inside a tier. Lower is more urgent. */
  rank: number;
};

const DAY = 86_400_000;
const STALLED_AFTER_DAYS = 7;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysBetween(a: number, b: number): number {
  return Math.round((a - b) / DAY);
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function followUpDay(contact: CrmContact | null): number | null {
  if (!contact?.next_follow_up_at) return null;
  const d = new Date(contact.next_follow_up_at);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * One item per row at most. A DJ with an overdue follow-up AND an
 * upcoming gig appears once, at the more urgent of the two, so the
 * queue length is a count of people rather than of reasons.
 */
export function buildQueue(rows: PipelineRow[]): QueueItem[] {
  const today = startOfToday();
  const items: QueueItem[] = [];

  for (const row of rows) {
    const contact = row.contact;
    const due = followUpDay(contact);

    if (due !== null && due < today) {
      const late = daysBetween(today, due);
      items.push({
        row,
        tier: "overdue",
        reason: contact?.next_action || "Follow-up overdue",
        stamp: `${late}d late`,
        rank: -late,
      });
      continue;
    }

    if (due !== null && due === today) {
      items.push({
        row,
        tier: "today",
        reason: contact?.next_action || "Follow-up due today",
        stamp: "Today",
        rank: 0,
      });
      continue;
    }

    const gig = contact?.next_gig_date ? new Date(contact.next_gig_date) : null;
    if (gig && !Number.isNaN(gig.getTime())) {
      gig.setHours(0, 0, 0, 0);
      const away = daysBetween(gig.getTime(), today);
      if (away >= 0 && away <= 7) {
        items.push({
          row,
          tier: "upcoming",
          reason: contact?.next_action || "Gig coming up",
          stamp: shortDate(contact!.next_gig_date!),
          rank: away,
        });
        continue;
      }
    }

    if (due !== null && due > today) {
      const away = daysBetween(due, today);
      items.push({
        row,
        tier: "upcoming",
        reason: contact?.next_action || "Follow-up scheduled",
        stamp: shortDate(contact!.next_follow_up_at!),
        rank: away,
      });
      continue;
    }

    if (row.stage === "ready_to_activate" && !contact?.activation_blocker) {
      items.push({
        row,
        tier: "ready",
        reason: "Ready to activate, no blocker recorded",
        stamp: "No blocker",
        rank: 0,
      });
      continue;
    }

    /*
     * Signed up a week or more ago, never finished onboarding, and
     * nobody has ever spoken to them. Without the "never contacted"
     * condition this would re-list the same nine people forever, which
     * is how a queue stops being read.
     */
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

  const order = new Map(QUEUE_TIERS.map((t, i) => [t, i]));
  return items.sort((a, b) => {
    const tier = order.get(a.tier)! - order.get(b.tier)!;
    return tier !== 0 ? tier : a.rank - b.rank;
  });
}

export function countByTier(items: QueueItem[]): Record<QueueTier, number> {
  const counts = Object.fromEntries(
    QUEUE_TIERS.map((t) => [t, 0])
  ) as Record<QueueTier, number>;
  for (const item of items) counts[item.tier] += 1;
  return counts;
}
