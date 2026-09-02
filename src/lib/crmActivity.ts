import type {
  CrmNote,
  CrmTask,
  PipelineRow,
} from "@/src/components/admin/crmTypes";

/*
 * ── One timeline, three sources, nothing duplicated ───────────────
 *
 * Manual activity is stored, because only a person knows it happened.
 * Task completions are read from crm_tasks, which is why completing a
 * task deliberately writes no note: 14 of the 23 imported contacts
 * carry boilerplate next actions, and auto-noting completions would
 * have buried the real history under entries nobody wrote.
 * Product events are derived from data the product already keeps.
 *
 * Some product events are known to have happened but have no provable
 * date, because onboarding, payments and Pro were booleans before the
 * lifecycle stamps existed. Those render as "before tracking began".
 * Nothing here ever substitutes today's date for an unknown one.
 *
 * The fourth kind, added 2026-09-02, is email delivery history. It is
 * kept deliberately separate from "product" because it is a different
 * sort of fact: a product event is something the DJ did, and an email
 * event is something we did to them. It is read from
 * dj_lifecycle_emails and is NEVER an input to lifecycle stage, the
 * funnel, or a Contacts group. A DJ who received two reminders and
 * ignored them is in exactly the same state as one who received none.
 *
 * A "claimed" row is reported as uncertain rather than resolved in
 * either direction. It means the process died between claiming the send
 * and hearing back from the provider, so we genuinely do not know
 * whether it arrived, and guessing would either hide a missed DJ or
 * invite a duplicate.
 */

export type ActivityKind = "manual" | "task" | "product" | "email";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  /** Null means it happened, but the date predates tracking. */
  at: string | null;
  /* Set only where an entry needs to be noticed: a failed or uncertain
     send. Everything else is history and reads as history. */
  tone?: "attention";
  /** Sort key. Undated events sink to the bottom. */
  sortAt: number;
};

const UNDATED = -Infinity;

export function buildActivity(
  row: PipelineRow,
  notes: CrmNote[],
  tasks: CrmTask[]
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const note of notes) {
    entries.push({
      id: `note:${note.id}`,
      kind: "manual",
      title: note.body,
      at: note.occurred_at,
      sortAt: new Date(note.occurred_at).getTime(),
    });
  }

  for (const task of tasks) {
    if (!task.completed_at) continue;
    entries.push({
      id: `task:${task.id}`,
      kind: "task",
      title: "Task completed",
      detail: task.title,
      at: task.completed_at,
      sortAt: new Date(task.completed_at).getTime(),
    });
  }

  const dj = row.dj;
  if (dj) {
    const product: [string, string | null, boolean][] = [
      ["Account created", dj.created_at, true],
      /* known-to-have-happened flags decide whether an undated event is
         shown at all: a DJ who never onboarded gets no entry, one who
         onboarded before the stamps existed gets an undated one. */
      ["Finished onboarding", dj.onboarded_at, dj.onboarding_complete],
      ["Connected payments", dj.payments_ready_at, dj.stripe_connected],
      ["First request received", dj.first_request_at, !!dj.first_request_at],
      [
        "First paid request accepted",
        dj.first_paid_at,
        !!dj.first_paid_at,
      ],
      ["Came back for a second night", dj.repeat_night_at, !!dj.repeat_night_at],
      ["Became Pro", dj.pro_since, dj.plan === "pro"],
    ];

    for (const [title, at, happened] of product) {
      if (!happened) continue;
      entries.push({
        id: `product:${title}`,
        kind: "product",
        title,
        at,
        sortAt: at ? new Date(at).getTime() : UNDATED,
      });
    }
  }

  for (const email of dj?.lifecycle_emails ?? []) {
    const which =
      email.template_key === "recovery_1" ? "Setup reminder" : "Final setup reminder";

    const [title, at] =
      email.status === "sent"
        ? [`${which} sent`, email.sent_at]
        : email.status === "failed"
          ? [`${which} failed to send`, email.last_error_at ?? email.created_at]
          : [`${which} delivery uncertain`, email.created_at];

    entries.push({
      id: `email:${email.template_key}`,
      kind: "email",
      tone: email.status === "sent" ? undefined : "attention",
      title,
      detail:
        email.status === "claimed"
          ? "Claimed but never confirmed by the provider. Not retried automatically."
          : email.attempts > 1
            ? `Attempt ${email.attempts}`
            : undefined,
      at,
      sortAt: at ? new Date(at).getTime() : UNDATED,
    });

    /*
     * A separate entry rather than a detail on the send, because it is a
     * separate event with its own date: we did something, and then some
     * time later they did something. Collapsing them would lose the gap,
     * which is the only interesting part.
     */
    if (email.returned_at) {
      entries.push({
        id: `email-return:${email.template_key}`,
        kind: "email",
        title: `Came back from the ${
          email.template_key === "recovery_1" ? "setup reminder" : "final setup reminder"
        }`,
        detail: "Signed in and reached the setup page the email pointed at",
        at: email.returned_at,
        sortAt: new Date(email.returned_at).getTime(),
      });
    }
  }

  /*
   * Newest first. Ties break manual, then task, then email, then
   * product, so an interaction sits above the event it caused rather
   * than below it.
   */
  const kindRank: Record<ActivityKind, number> = {
    manual: 0,
    task: 1,
    email: 2,
    product: 3,
  };

  return entries.sort((a, b) => {
    if (a.sortAt !== b.sortAt) return b.sortAt - a.sortAt;
    return kindRank[a.kind] - kindRank[b.kind];
  });
}

export function activityDate(entry: ActivityEntry): string {
  if (!entry.at) return "Before tracking began";
  return new Date(entry.at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year:
      new Date(entry.at).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });
}
