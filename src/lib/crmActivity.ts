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
 */

export type ActivityKind = "manual" | "task" | "product";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  /** Null means it happened, but the date predates tracking. */
  at: string | null;
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

  /*
   * Newest first. Ties break manual, then task, then product, so an
   * interaction sits above the event it caused rather than below it.
   */
  const kindRank: Record<ActivityKind, number> = {
    manual: 0,
    task: 1,
    product: 2,
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
