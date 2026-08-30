import type { TaskItem, StateItem } from "@/src/lib/crmQueue";
import type { PipelineRow } from "@/src/components/admin/crmTypes";

/*
 * ── The filters that survived grouping ────────────────────────────
 *
 * Contacts used to open on a wall of nine lifecycle chips above a flat
 * list of everyone. The grouped directory answers that question better:
 * the sections ARE the lifecycle split, visible at a glance and without
 * choosing anything first, so a chip row that filtered to one stage was
 * doing the same work twice and taking a screen to do it.
 *
 * What is left is only what cuts ACROSS the groups, which is the test a
 * filter has to pass to earn a permanent place on screen. Measured
 * against the real 32 rows on 2026-08-30: never contacted matched 27,
 * awaiting reply and venue blocker are the two states worth pulling out
 * of any group at once.
 *
 * Deliberately not here: an open-task filter. Tasks is the destination
 * for "what do I need to do", and answering it a second time in
 * Contacts is the conflation this architecture keeps taking apart.
 *
 * Nothing below re-derives a rule. "Awaiting reply" is the state tier
 * by name, straight out of buildStateQueue.
 */

export type SecondaryFilter = "awaiting" | "never_contacted" | "venue" | null;

export const SECONDARY_FILTERS = [
  "awaiting",
  "never_contacted",
  "venue",
] as const;

export const SECONDARY_LABELS: Record<string, string> = {
  awaiting: "Awaiting reply",
  never_contacted: "Never contacted",
  venue: "Venue blocker",
};

export function buildFilterIndex(
  rows: PipelineRow[],
  _taskItems: TaskItem[],
  stateItems: StateItem[]
) {
  const awaiting = new Set(
    stateItems.filter((s) => s.tier === "awaiting").map((s) => s.row.key)
  );

  const matchesSecondary = (row: PipelineRow, f: SecondaryFilter) => {
    if (!f) return true;
    if (f === "awaiting") return awaiting.has(row.key);
    if (f === "never_contacted") return !row.contact?.last_contact_at;
    return row.contact?.activation_blocker === "venue_refused";
  };

  const counts: Record<string, number> = {};
  for (const f of SECONDARY_FILTERS) {
    counts[f] = rows.filter((r) => matchesSecondary(r, f)).length;
  }

  return { matchesSecondary, counts };
}
