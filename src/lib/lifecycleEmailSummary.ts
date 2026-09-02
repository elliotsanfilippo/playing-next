import type { PipelineRow } from "@/src/components/admin/crmTypes";

/*
 * ── Setup reminders, counted honestly ─────────────────────────────
 *
 * The whole point of this module is one distinction that a naive count
 * would destroy.
 *
 * The nine R1 emails sent on 2026-09-02 used a CTA marked
 * ?from=onboarding, which four buttons on the Onboarding screen also
 * produce. A hit on that URL cannot be told apart from a tap inside the
 * app, so for those nine a return is not zero, it is UNKNOWABLE. Putting
 * them in a denominator would render as "9 sent, 0 came back", which
 * reads as a total failure and is simply not a fact.
 *
 * So they are counted separately, and labelled as unmeasurable rather
 * than as unsuccessful. Only emails carrying the unique
 * ?from=recovery_1 / ?from=recovery_2 markers can produce a return rate,
 * and the row itself says which it is via return_tracked.
 *
 * Conversion is reported across BOTH cohorts, because that half is
 * honest for everyone: whether a DJ reached Ready to activate after
 * being emailed does not depend on our being able to see their click.
 */

export type ReminderSummary = {
  /** Emails whose returns can be attributed. */
  tracked: { sent: number; returned: number };
  /** Emails sent before the markers existed. Returns unknowable. */
  untracked: { sent: number };
  /** Everyone emailed, and how many have since reached Ready to activate. */
  emailed: number;
  reachedReady: number;
};

/* Ready to activate, or anything past it. A DJ who has since activated
   did reach Ready to activate on the way, and reporting otherwise would
   undercount the outcome we care about most. */
const CONVERTED = new Set(["ready_to_activate", "activated", "repeat", "pro"]);

export function summariseReminders(rows: PipelineRow[]): ReminderSummary {
  const summary: ReminderSummary = {
    tracked: { sent: 0, returned: 0 },
    untracked: { sent: 0 },
    emailed: 0,
    reachedReady: 0,
  };

  for (const row of rows) {
    const emails = row.dj?.lifecycle_emails ?? [];
    const sent = emails.filter((e) => e.status === "sent");

    if (sent.length === 0) continue;

    summary.emailed += 1;
    if (CONVERTED.has(row.dj?.lifecycle_stage ?? "")) summary.reachedReady += 1;

    for (const email of sent) {
      if (email.return_tracked) {
        summary.tracked.sent += 1;
        if (email.returned_at) summary.tracked.returned += 1;
      } else {
        summary.untracked.sent += 1;
      }
    }
  }

  return summary;
}

/**
 * The one line the collapsed section shows.
 *
 * Never "N sent, 0 came back" while every send is untracked, because
 * that sentence is a claim we cannot support.
 */
export function reminderMeta(summary: ReminderSummary): string | undefined {
  const { tracked, untracked } = summary;

  if (tracked.sent === 0 && untracked.sent === 0) return undefined;

  if (tracked.sent === 0) {
    return `${untracked.sent} sent · returns not measurable`;
  }

  const parts = [`${tracked.sent} sent`, `${tracked.returned} came back`];

  if (untracked.sent > 0) {
    parts.push(`${untracked.sent} earlier, not measurable`);
  }

  return parts.join(" · ");
}
