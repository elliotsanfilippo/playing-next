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
  /* Present on lifecycle-email entries. One email is ONE item: its
     subject, the state the DJ was in when it went, and every delivery
     fact on a single line. Three separate cards for one message would
     treble the timeline and bury the only interesting part, which is
     the gap between sending and coming back. */
  email?: EmailActivity;
  /** Sort key. Undated events sink to the bottom. */
  sortAt: number;
};

const UNDATED = -Infinity;

/** A stamp with no time renders as its label alone, never as a blank. */
export type ActivityStamp = { label: string; at: string | null };

export type EmailActivity = {
  /** Exactly what the DJ received. Null only for rows sent before it was stored. */
  subject: string | null;
  /** Human language. The stored A/B/C never reaches a screen. */
  stateLabel: string;
  stamps: ActivityStamp[];
  /** Said plainly when a fact is unknowable rather than absent. */
  note?: string;
};

/*
 * The public names for things stored as identifiers. Every one of these
 * mappings exists so that recovery_1, recovery_2, A, B and C stay
 * internal: they are how the rules are written, not how anyone talks
 * about a DJ.
 */
const EMAIL_NAMES: Record<string, string> = {
  recovery_1: "Setup email",
  recovery_2: "Setup follow-up",
};

const STATE_LABELS: Record<string, string> = {
  A: "Profile + payouts incomplete",
  B: "Payouts incomplete",
  C: "Profile incomplete",
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

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
      /*
       * Only ever shown WITH a date.
       *
       * Every other product event here can render undated as "before
       * tracking began", because the entry still says something true:
       * it happened, we cannot date it. This one is different, and
       * Elliot drew the line on 2026-09-02: a chronological timeline
       * should contain events with honest times, and an undated
       * "Profile completed" is a fact the contact's own lifecycle state
       * already communicates without pretending to be a moment.
       *
       * So the third element is the timestamp rather than a "did it
       * happen" flag. Null omits the row entirely, which is the
       * behaviour the five profiles completed before the column existed
       * will get for ever.
       */
      ["Profile completed", dj.profile_completed_at, !!dj.profile_completed_at],
      /* known-to-have-happened flags decide whether an undated event is
         shown at all: a DJ who never onboarded gets no entry, one who
         onboarded before the stamps existed gets an undated one. */
      /* onboarding_complete requires stripe_connected, so this stamp is
         the moment the DJ became Ready to activate. The old label named
         our funnel rather than their position. */
      ["Ready to activate", dj.onboarded_at, dj.onboarding_complete],
      ["Payouts connected", dj.payments_ready_at, dj.stripe_connected],
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
    const name = EMAIL_NAMES[email.template_key] ?? "Lifecycle email";

    const [title, at] =
      email.status === "sent"
        ? [`${name} sent`, email.sent_at]
        : email.status === "failed"
          ? [`${name} failed to send`, email.last_error_at ?? email.created_at]
          : [`${name} delivery uncertain`, email.created_at];

    /*
     * Only facts we hold. A missing delivery or return produces no
     * stamp at all rather than an empty one, because "Returned —" reads
     * as a measured nothing and we may simply not know.
     */
    const stamps: ActivityStamp[] = [];

    if (email.sent_at) stamps.push({ label: "Sent", at: email.sent_at });

    if (email.delivery_state === "delivered") {
      /* at may be null: Resend reports the state for the historical
         nine but not the moment, so this renders as "Delivered". */
      stamps.push({ label: "Delivered", at: email.delivery_state_at });
    } else if (email.delivery_state) {
      stamps.push({ label: capitalise(email.delivery_state), at: email.delivery_state_at });
    }

    if (email.returned_at) {
      stamps.push({ label: "Returned to Playing Next", at: email.returned_at });
    }

    entries.push({
      id: `email:${email.template_key}`,
      kind: "email",
      tone: email.status === "sent" ? undefined : "attention",
      title,
      at,
      sortAt: at ? new Date(at).getTime() : UNDATED,
      email: {
        subject: email.subject_at_send,
        stateLabel: STATE_LABELS[email.state_at_send] ?? "",
        stamps,
        note:
          email.status === "claimed"
            ? "Claimed but never confirmed by the provider. Not retried automatically."
            : !email.return_tracked
              ? "Return tracking was not in place for this email"
              : undefined,
      },
    });
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

/**
 * The clock on a delivery stamp, in the reader's own timezone.
 *
 * Formatted here rather than baked into the string when the entry is
 * built, so "Sent 21:57" means 21:57 where the person reading it is,
 * which is the only reading of it anybody wants.
 */
export function activityTime(at: string): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
