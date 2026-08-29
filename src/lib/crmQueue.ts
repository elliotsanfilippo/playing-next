import { blockerPolicy } from "@/src/lib/crmTaxonomy";
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
/*
 * Tier order is the priority order: a lower tier can never outrank a
 * higher one whatever its date.
 *
 * "upcoming" sits above "awaiting reply" deliberately. A gig with a date
 * on it is time-sensitive and is the single event that turns a
 * payments-ready DJ into an activated one, so it has to be prepared for
 * before the day arrives. Waiting on a reply matters just as much in
 * aggregate but rarely has to happen today, and it does not expire.
 */
export const QUEUE_TIERS = [
  "overdue",
  "today",
  "upcoming",
  "attention",
  "stalled",
] as const;

export type QueueTier = (typeof QUEUE_TIERS)[number];

export const TIER_LABELS: Record<QueueTier, string> = {
  overdue: "Overdue",
  today: "Today",
  attention: "Awaiting reply",
  upcoming: "Upcoming",
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

/* Midnight of the day a timestamp falls on. Comparing a raw timestamp
   against today's midnight makes yesterday lunchtime round to zero days,
   which had the queue saying "Contacted today" about the same 28 Aug
   contact the Contacts list correctly called "Yesterday". */
function dayOf(value: string): number | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
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
          reason: contact?.next_action?.trim() || "Gig coming up",
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

    /*
     * Does an unresolved relationship still need you? Decided by the
     * blocker's policy, not by whether the field happens to be set.
     *
     * This deliberately does not test lifecycle stage. Ben Phillips is
     * onboarding-incomplete rather than ready-to-activate, and he is
     * still someone we are waiting on a reply from; gating on
     * ready_to_activate would drop him exactly the way the previous rule
     * dropped everyone else.
     */
    const hasBlocker = !!contact?.activation_blocker;
    const policy = blockerPolicy(contact?.activation_blocker);
    const hasNextAction = !!contact?.next_action?.trim();
    const isReady = row.stage === "ready_to_activate";

    /*
     * With a blocker recorded, its policy decides. Without one, only a
     * ready-to-activate DJ surfaces - the original rule, kept.
     *
     * The distinction matters: "no blocker recorded" is the default for
     * all 23 imported contacts, so treating an absent blocker as "always
     * needs you" would have put fifteen cold prospects nobody has ever
     * spoken to into a queue titled Awaiting reply. A cold prospect
     * enters the queue by being given a follow-up date, which is a
     * decision, not by existing.
     */
    const needsAttention = hasBlocker
      ? policy === "always"
        ? true
        : policy === "when_due"
          ? hasNextAction
          : false
      : isReady;

    if (needsAttention) {
      const contactedOn = contact?.last_contact_at
        ? dayOf(contact.last_contact_at)
        : null;
      const waitingDays =
        contactedOn !== null ? daysBetween(today, contactedOn) : null;

      items.push({
        row,
        tier: "attention",
        reason:
          contact?.next_action?.trim() ||
          (contact?.activation_blocker
            ? "Waiting on a reply"
            : "Ready to activate, no blocker recorded"),
        stamp:
          waitingDays !== null
            ? waitingDays === 0
              ? "Contacted today"
              : waitingDays === 1
                ? "Waiting 1 day"
                : `${waitingDays}d waiting`
            : contact?.activation_blocker
              ? "No reply yet"
              : "No blocker",
        /* Ready-to-activate first, then longest-waiting first. */
        rank: (isReady ? -10_000 : 0) - (waitingDays ?? 0),
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
        reason:
          contact?.next_action?.trim() ||
          "Signed up and never finished setup. Never contacted.",
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

/*
 * ── Default order for the Contacts list ───────────────────────────
 *
 * Importing the real pipeline put sixteen cold prospects above every
 * account: the list opened on Ellis Tilson and Badja, people with no
 * account and no contact ever, while Cammy Birse sat at row 26 of 32.
 * Newest-first is the wrong axis when most of what is new is also the
 * coldest thing in the file.
 *
 * The order is therefore by how much of your attention a row has a
 * claim on:
 *
 *   1  anything in the Needs You queue, in queue order
 *   2  DJs with accounts, most advanced stage first
 *   3  prospects you have actually spoken to, most recent first
 *   4  cold prospects, newest first
 *
 * Search and the Pipeline view are unaffected; this is only the default
 * resting order of the list.
 */
const STAGE_RANK: Record<string, number> = {
  pro: 0,
  repeat: 1,
  activated: 2,
  ready_to_activate: 3,
  onboarded: 4,
  payments_ready: 5,
  onboarding_incomplete: 6,
  signed_up: 7,
  prospect: 8,
};

export function sortForContacts(
  rows: PipelineRow[],
  queue: QueueItem[]
): PipelineRow[] {
  const queuePosition = new Map(queue.map((item, index) => [item.row.key, index]));

  const band = (row: PipelineRow): number => {
    if (queuePosition.has(row.key)) return 0;
    if (row.dj) return 1;
    if (row.contact?.last_contact_at) return 2;
    return 3;
  };

  return [...rows].sort((a, b) => {
    const bandDiff = band(a) - band(b);
    if (bandDiff !== 0) return bandDiff;

    if (band(a) === 0) {
      return queuePosition.get(a.key)! - queuePosition.get(b.key)!;
    }

    if (band(a) === 1) {
      const stage =
        (STAGE_RANK[a.stage] ?? 9) - (STAGE_RANK[b.stage] ?? 9);
      if (stage !== 0) return stage;
      return (
        new Date(b.dj!.created_at).getTime() -
        new Date(a.dj!.created_at).getTime()
      );
    }

    if (band(a) === 2) {
      return (
        new Date(b.contact!.last_contact_at!).getTime() -
        new Date(a.contact!.last_contact_at!).getTime()
      );
    }

    return (
      new Date(b.contact?.created_at ?? 0).getTime() -
      new Date(a.contact?.created_at ?? 0).getTime()
    );
  });
}
