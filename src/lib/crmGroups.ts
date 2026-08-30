import { isInternalDj } from "@/src/lib/internalAccounts";
import type { PipelineRow } from "@/src/components/admin/crmTypes";

/*
 * ── Where each person sits in the directory, decided once ─────────
 *
 * Contacts answers "who are all my people and where are they", so it is
 * organised rather than merely sorted. The groups below are the whole
 * answer, and every row belongs to exactly one of them.
 *
 * Nothing here re-derives a lifecycle stage. Seven of the eight groups
 * ARE a lifecycle stage, read straight off row.stage, which
 * resolveLifecycleStage already decided. If the definition of "ready to
 * activate" changes, it changes in djLifecycle.ts and this follows.
 *
 * The eighth group is the only judgement this module makes, and it is
 * the reason precedence exists at all.
 */

export const CONTACT_GROUPS = [
  "new_signups",
  "ready_to_activate",
  "onboarded",
  "onboarding_incomplete",
  "prospect",
  "activated",
  "repeat",
  "pro",
] as const;

export type ContactGroup = (typeof CONTACT_GROUPS)[number];

export const GROUP_LABELS: Record<ContactGroup, string> = {
  new_signups: "New signups",
  ready_to_activate: "Ready to activate",
  onboarded: "Onboarded",
  onboarding_incomplete: "Onboarding",
  prospect: "Prospects",
  activated: "Activated",
  repeat: "Repeat",
  pro: "Pro",
};

/*
 * Shown under the heading, because a count on its own does not tell you
 * what the group is for. "Onboarding 10" reads as a problem or as
 * progress depending entirely on what you think it means.
 */
export const GROUP_DESCRIPTIONS: Record<ContactGroup, string> = {
  new_signups:
    "Playing Next accounts with no CRM context yet. Open one to add context or link it to a prospect you already have.",
  ready_to_activate:
    "Set up and able to take paid requests. Nothing technical is missing, so what they need is a gig.",
  onboarded: "Finished onboarding, but payments are not connected yet.",
  onboarding_incomplete: "Signed up but haven't finished getting set up.",
  prospect: "In the CRM with no Playing Next account yet.",
  activated: "Have taken at least one paid request.",
  repeat: "Have taken paid requests on two or more separate nights.",
  pro: "On a Pro subscription.",
};

/**
 * The one place precedence is decided.
 *
 * An account with no CRM contact has two true answers at once: it is a
 * signup nobody has written anything about, AND it sits at some
 * lifecycle stage. Showing it in both places would put the same person
 * under two headings and stop the counts adding up to the total, so New
 * signups wins - it is the group you act on, and acting on it is what
 * moves the person into their lifecycle group for good.
 *
 * Internal accounts are deliberately excluded from it. They are ours,
 * nobody is ever going to write outreach context about them, and
 * including them would leave three rows permanently stuck in a queue
 * whose entire purpose is to be emptied. They stay fully visible in
 * their real lifecycle group, tagged Internal - which is also what
 * keeps Pro and Repeat from reading as empty when they are not.
 */
export function groupFor(row: PipelineRow): ContactGroup {
  if (row.dj && !row.contact && !isInternalDj(row.dj.slug)) {
    return "new_signups";
  }

  /*
   * Every stage the resolver can return is a group. "signed_up" and
   * "payments_ready" are in the enum but are never its answer; if that
   * ever changed, this puts them somewhere visible rather than letting
   * a person quietly vanish from the directory.
   */
  return (CONTACT_GROUPS as readonly string[]).includes(row.stage)
    ? (row.stage as ContactGroup)
    : "onboarding_incomplete";
}

export type ContactGroupSection = {
  key: ContactGroup;
  label: string;
  description: string;
  rows: PipelineRow[];
};

/**
 * Groups in display order, empty ones removed.
 *
 * Order is by claim on attention rather than funnel position: the
 * people you can do something about today come before the wins. An
 * empty group is hidden because a heading reading "Activated 0" is a
 * fact about the whole business, which Overview already reports, not a
 * place to look for somebody.
 *
 * `rows` arrives already sorted by sortForContacts, and partitioning
 * preserves that order inside each group.
 */
export function buildGroups(rows: PipelineRow[]): ContactGroupSection[] {
  const map = new Map<ContactGroup, PipelineRow[]>(
    CONTACT_GROUPS.map((g) => [g, []])
  );

  for (const row of rows) map.get(groupFor(row))!.push(row);

  return CONTACT_GROUPS.filter((g) => map.get(g)!.length > 0).map((g) => ({
    key: g,
    label: GROUP_LABELS[g],
    description: GROUP_DESCRIPTIONS[g],
    rows: map.get(g)!,
  }));
}
