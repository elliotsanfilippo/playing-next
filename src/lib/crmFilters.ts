import { LIFECYCLE_LABELS, type LifecycleStage } from "@/src/lib/djLifecycle";
import type { TaskItem, StateItem } from "@/src/lib/crmQueue";
import type { PipelineRow } from "@/src/components/admin/crmTypes";

/*
 * ── Filters that borrow their rules rather than restating them ────
 *
 * Nothing here re-derives a lifecycle stage or re-implements the
 * blocker policy. "Needs attention" and "Awaiting reply" are read
 * straight out of buildQueue, and every other primary filter compares
 * against row.stage, which resolveLifecycleStage already decided. If
 * the definition of "ready to activate" ever changes, it changes in one
 * place and these follow.
 */

export type PrimaryFilter = "all" | "needs" | LifecycleStage;
export type SecondaryFilter = "awaiting" | "never_contacted" | "venue" | null;

/* Order matters: this is the order the chips appear in. */
export const PRIMARY_ORDER: PrimaryFilter[] = [
  "all",
  "needs",
  "prospect",
  "onboarding_incomplete",
  "onboarded",
  "ready_to_activate",
  "activated",
  "repeat",
  "pro",
];

export const PRIMARY_LABELS: Record<string, string> = {
  all: "All",
  needs: "Needs attention",
  prospect: "Prospects",
  onboarding_incomplete: "Onboarding",
  onboarded: "Onboarded",
  ready_to_activate: "Ready",
  activated: "Activated",
  repeat: "Repeat",
  pro: "Pro",
};

export const SECONDARY_LABELS: Record<string, string> = {
  awaiting: "Awaiting reply",
  never_contacted: "Never contacted",
  venue: "Venue blocker",
};

export type FilterCounts = {
  primary: Record<string, number>;
  secondary: Record<string, number>;
};

export function buildFilterIndex(
  rows: PipelineRow[],
  taskItems: TaskItem[],
  stateItems: StateItem[]
) {
  /*
   * "Needs attention" is anyone with something to do OR something worth
   * knowing - the union of the two Overview sections, not a third
   * definition. "Awaiting reply" is the state tier by name.
   */
  const withTask = new Set(
    taskItems.filter((t) => t.row).map((t) => t.row!.key)
  );
  const inState = new Set(stateItems.map((s) => s.row.key));
  const inQueue = new Set([...withTask, ...inState]);
  const awaiting = new Set(
    stateItems.filter((s) => s.tier === "awaiting").map((s) => s.row.key)
  );

  const matchesPrimary = (row: PipelineRow, f: PrimaryFilter) => {
    if (f === "all") return true;
    if (f === "needs") return inQueue.has(row.key);
    return row.stage === f;
  };

  const matchesSecondary = (row: PipelineRow, f: SecondaryFilter) => {
    if (!f) return true;
    if (f === "awaiting") return awaiting.has(row.key);
    if (f === "never_contacted") return !row.contact?.last_contact_at;
    return row.contact?.activation_blocker === "venue_refused";
  };

  const counts: FilterCounts = { primary: {}, secondary: {} };
  for (const f of PRIMARY_ORDER) {
    counts.primary[f] = rows.filter((r) => matchesPrimary(r, f)).length;
  }
  for (const f of ["awaiting", "never_contacted", "venue"] as const) {
    counts.secondary[f] = rows.filter((r) => matchesSecondary(r, f)).length;
  }

  return { matchesPrimary, matchesSecondary, counts };
}

/**
 * Which primary chips to render.
 *
 * "All" and "Needs attention" always show, even at zero, because their
 * absence would be confusing rather than tidy. A lifecycle stage with
 * nobody in it is hidden and reappears on its own the day somebody
 * reaches it - which for Activated is the day we have been waiting for.
 */
export function visiblePrimary(counts: FilterCounts): PrimaryFilter[] {
  return PRIMARY_ORDER.filter(
    (f) => f === "all" || f === "needs" || counts.primary[f] > 0
  );
}

export function primaryLabel(f: PrimaryFilter): string {
  return PRIMARY_LABELS[f] ?? LIFECYCLE_LABELS[f as LifecycleStage] ?? f;
}
