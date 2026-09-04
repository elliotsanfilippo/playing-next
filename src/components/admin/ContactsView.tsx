"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, AlertTriangle, ChevronDown } from "lucide-react";
import Card from "@/src/components/ui/Card";
import { useIsDesktop } from "@/src/lib/useIsDesktop";
import Badge from "@/src/components/ui/Badge";
import Button from "@/src/components/ui/Button";
import { FUNNEL_STAGES, LIFECYCLE_LABELS, type LifecycleStage } from "@/src/lib/djLifecycle";
import { BLOCKER_LABELS, type ActivationBlocker } from "@/src/lib/crmTaxonomy";
import { rowIdentity, joinedLabel, relativeDays } from "@/src/lib/djIdentity";
import { isInternalDj } from "@/src/lib/internalAccounts";
import { stageTone } from "@/src/components/admin/stageTone";
import ContactIdentity from "@/src/components/admin/ContactIdentity";
import {
  buildTaskQueue,
  buildStateQueue,
  sortForContacts,
} from "@/src/lib/crmQueue";
import {
  buildFilterIndex,
  SECONDARY_FILTERS,
  SECONDARY_LABELS,
  type SecondaryFilter,
} from "@/src/lib/crmFilters";
import {
  buildGroups,
  groupFor,
  GROUP_LABELS,
  type ContactGroup,
} from "@/src/lib/crmGroups";
import type {
  CrmContact,
  CrmTask,
  PipelineRow,
} from "@/src/components/admin/crmTypes";

/*
 * The Pipeline view is a desktop view. A six-column board on a 390px
 * screen is a horizontal scroll inside a vertical scroll, which is the
 * treatment the design explicitly rejected as unusable one-handed, so
 * narrow screens get the List and the toggle is not offered at all.
 *
 * useSyncExternalStore rather than an effect: the value is read from an
 * external system, it must not cause a second render on mount, and it
 * gives a stable server snapshot so hydration cannot mismatch.
 */
type View = "list" | "pipeline";

/*
 * Reads the soonest open task, never next_follow_up_at. The legacy
 * column stays in the database untouched; nothing in the interface
 * looks at it.
 */
function followUpCell(task: CrmTask | null) {
  if (!task?.due_at) {
    return <span className="text-text-muted">&mdash;</span>;
  }
  const due = new Date(task.due_at);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - due.getTime()) / 86_400_000);

  if (days > 0) {
    return (
      <span className="font-semibold text-status-declined">
        Overdue {days}d
      </span>
    );
  }
  if (days === 0) {
    return <span className="font-semibold text-status-pending">Today</span>;
  }
  return (
    <span className="text-zinc-300">
      {due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
    </span>
  );
}

function Identity({ row }: { row: PipelineRow }) {
  const id = rowIdentity(row);
  return (
    <>
      <p
        className={`font-semibold text-white ${id.isSlug ? "font-mono text-sm" : ""}`}
      >
        {id.primary}
        {isInternalDj(row.dj?.slug) && (
          <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.6rem] font-normal uppercase tracking-wider text-text-muted">
            internal
          </span>
        )}
      </p>
      <p className="font-mono text-xs text-text-muted">
        {row.dj
          ? `${id.isSlug ? "" : `/${row.dj.slug} · `}joined ${joinedLabel(row.dj.created_at)}`
          : "No account yet"}
      </p>
    </>
  );
}

function StageCell({ row }: { row: PipelineRow }) {
  /*
    "Ready, not yet attempted" printed under a badge reading "Ready to
    activate" says Ready twice and adds nothing the second time. The
    same suppression as the Overview queue, applied here so one person
    does not read differently on two screens. Every other blocker says
    something the stage does not, and is kept.
  */
  const blocker = row.contact?.activation_blocker;
  const restatesStage =
    blocker === "ready_not_attempted" && row.stage === "ready_to_activate";

  return (
    <>
      <Badge tone={stageTone(row.stage)}>{LIFECYCLE_LABELS[row.stage]}</Badge>
      {blocker && !restatesStage && (
        <p className="mt-1 text-xs text-status-pending">
          {BLOCKER_LABELS[blocker as ActivationBlocker]}
        </p>
      )}
    </>
  );
}

/*
 * One mobile row. Four lines at most, and the last three only when they
 * carry something: a line reading "last contact never" on fifteen
 * consecutive prospects is a placeholder for absence, not information.
 *
 * The lifecycle badge is drawn only under New signups, and the rule is
 * the same wherever the row appears: show the stage when the group name
 * does not already carry it. Seven of the eight groups ARE the stage,
 * so a badge beside them restates the heading on every row - "Onboarding
 * incomplete" under a heading reading "Onboarding" - which is how a
 * directory turns back into the wall of chips it replaced. New signups
 * is the exception because it describes the missing CRM context rather
 * than where the DJ has got to, so the stage is genuinely new
 * information there. Search results carry the group name instead.
 *
 * Identity goes through ContactIdentity like everywhere else, so a long
 * name and a long slug wrap the same way here as in the drawer.
 */
function ContactRow({
  row,
  task,
  groupLabel,
  showStage = false,
  onOpen,
}: {
  row: PipelineRow;
  task: CrmTask | null;
  groupLabel?: string;
  showStage?: boolean;
  onOpen: (key: string) => void;
}) {
  const blocker = row.contact?.activation_blocker
    ? BLOCKER_LABELS[row.contact.activation_blocker as ActivationBlocker]
    : null;
  const last = row.contact?.last_contact_at
    ? relativeDays(row.contact.last_contact_at).toLowerCase()
    : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(row.key)}
      className="w-full p-5 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
    >
      {/* Stacked, not name-versus-badge. Nothing competes. */}
      <ContactIdentity row={row} showStage={showStage} />

      {groupLabel && (
        <p className="mt-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-text-muted">
          {groupLabel}
        </p>
      )}

      {blocker && (
        <p className="mt-2.5 text-sm text-status-pending">{blocker}</p>
      )}

      {task?.title && (
        <p className="mt-1.5 text-sm text-zinc-200">{task.title}</p>
      )}

      {last && (
        <p className="mt-2 font-mono text-xs text-text-muted">
          last contact {last}
        </p>
      )}
    </button>
  );
}

export default function ContactsView({
  rows,
  tasks,
  onOpen,
  onAddProspect,
}: {
  rows: PipelineRow[];
  tasks: CrmTask[];
  onOpen: (key: string) => void;
  onAddProspect: (name: string) => Promise<void>;
}) {
  const [view, setView] = useState<View>("list");
  const isDesktop = useIsDesktop();
  /* Pipeline is never rendered narrow, whatever the toggle last held. */
  const effectiveView: View = isDesktop ? view : "list";
  const [search, setSearch] = useState("");
  const [secondary, setSecondary] = useState<SecondaryFilter>(null);
  /*
   * The one open group, or none. An accordion rather than independent
   * toggles: with several groups open at once you are back to scrolling
   * a long list to find the next heading, which is the thing the
   * directory replaced.
   *
   * It starts closed. Contacts is a question - who are all my people
   * and where are they - and the answer is the six headings and their
   * counts, which fit on one screen only while nothing is expanded.
   * Opening a group is choosing to inspect one, and that choice is
   * better made by the person than assumed on their behalf.
   *
   * Not persisted, and deliberately not lifted to the page: Contacts
   * unmounts when you switch destination, so coming back from Tasks
   * resets to the directory rather than reopening whatever you were
   * last reading.
   */
  const [openGroup, setOpenGroup] = useState<ContactGroup | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const taskItems = useMemo(() => buildTaskQueue(tasks, rows), [tasks, rows]);

  /* The soonest open task per contact, for the list's "next" column. */
  const nextTaskByContact = useMemo(() => {
    const map = new Map<string, CrmTask>();
    for (const item of taskItems) {
      const id = item.task.contact_id;
      if (!map.has(id)) map.set(id, item.task);
    }
    return map;
  }, [taskItems]);
  const nextTaskFor = (row: PipelineRow) =>
    row.contact ? (nextTaskByContact.get(row.contact.id) ?? null) : null;

  const stateItems = useMemo(() => buildStateQueue(rows), [rows]);
  const ordered = useMemo(
    () => sortForContacts(rows, taskItems, stateItems),
    [rows, taskItems, stateItems]
  );

  const index = useMemo(
    () => buildFilterIndex(rows, taskItems, stateItems),
    [rows, taskItems, stateItems]
  );

  /* Filters and search compose: both narrow the same ordered list, so
     "Ready" plus a search term means ready DJs matching that term, not
     one or the other. */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ordered.filter((r) => {
      if (!index.matchesSecondary(r, secondary)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.dj?.slug ?? "").toLowerCase().includes(q) ||
        (r.contact?.contact_handle ?? "").toLowerCase().includes(q)
      );
    });
  }, [ordered, search, secondary, index]);
  /*
   * Next action and Follow-up are dropped from the table when not one
   * visible row has an open task, which today is every visit: with 0
   * open tasks they rendered as two columns of em-dashes about 270px
   * wide, taking width from the three columns that do carry data.
   *
   * Hidden, not removed. They read the soonest open task - the live
   * task queue, NOT the retired next_action / next_follow_up_at columns
   * - so they come straight back the moment a task exists. An earlier
   * pass of this audit called them dead legacy columns and was wrong.
   */
  const anyOpenTask = useMemo(
    () => visible.some((row) => nextTaskFor(row) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, nextTaskByContact]
  );

  /*
   * Changing what you are looking at puts you at the top of it. Keyed on
   * the filter values only, so typing in the search box does not yank
   * the page while you are still deciding what to type.
   */
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [secondary]);

  /*
   * The grouped directory. Searching replaces it with a flat result
   * list rather than filtering inside the sections, because a search
   * that made you guess which group to open before you could see the
   * match would be worse than the list it replaced.
   */
  const searching = search.trim().length > 0;
  const groups = useMemo(() => buildGroups(visible), [visible]);

  /* Tapping the open one closes it, so zero or one is expanded. */
  const toggleGroup = (key: ContactGroup) =>
    setOpenGroup((current) => (current === key ? null : key));

  const byStage = useMemo(() => {
    const map = new Map<LifecycleStage, PipelineRow[]>();
    for (const stage of FUNNEL_STAGES) map.set(stage, []);
    for (const row of visible) {
      const list = map.get(row.stage);
      if (list) list.push(row);
    }
    return map;
  }, [visible]);

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="space-y-4 border-b border-white/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="hidden gap-1 rounded-control border border-white/10 bg-black/20 p-1 md:flex"
            role="group"
            aria-label="Contacts view"
          >
            {(["list", "pipeline"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`min-h-[44px] rounded-[0.7rem] px-4 text-xs font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  view === v
                    ? "bg-white/10 text-white"
                    : "text-text-muted hover:text-white"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative w-full sm:w-56">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  /* Searching leaves the grouped view, and clearing the
                     box comes back to the directory rather than to
                     whichever group happened to be open beforehand. */
                  setOpenGroup(null);
                }}
                placeholder="Search people..."
                aria-label="Search contacts"
                /* Names and slugs, not sentences: iOS would otherwise
                   capitalise the first letter and autocorrect
                   "/sgsoundsuk" into something else entirely. */
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="search"
                enterKeyHint="search"
                className="h-12 w-full rounded-control border border-white/10 bg-black/30 pl-9 pr-3 text-base text-white outline-none placeholder:text-zinc-600 focus:border-accent/40 md:h-10 md:text-sm"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-[44px] shrink-0"
              onClick={() => setAdding((v) => !v)}
            >
              <Plus size={15} className="mr-1.5" />
              Prospect
            </Button>
          </div>
        </div>

        {/*
          Three chips, not twelve. The lifecycle chips that used to sit
          above these are gone: the grouped sections below are that
          split, shown without having to choose anything first. What is
          left cuts across every group, which is the only thing a
          permanent control on a phone screen earns its place by doing.

          Tapping the active one clears it, so there is always a way back
          without a reset button.
        */}
        <div className="flex flex-wrap gap-2">
          {SECONDARY_FILTERS.filter((f) => index.counts[f] > 0).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSecondary(secondary === f ? null : f)}
              aria-pressed={secondary === f}
              className={`min-h-[44px] rounded-full border px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                secondary === f
                  ? "border-status-playing-surface/40 bg-status-playing-surface/10 text-status-playing"
                  : "border-white/10 bg-white/[0.03] text-text-muted hover:text-white"
              }`}
            >
              {SECONDARY_LABELS[f]}{" "}
              <span className="opacity-70">{index.counts[f]}</span>
            </button>
          ))}
        </div>

        {adding && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && name.trim()) {
                  await onAddProspect(name);
                  setName("");
                  setAdding(false);
                }
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Their name"
              aria-label="Prospect name"
              autoCapitalize="words"
              autoCorrect="off"
              className="h-12 w-full rounded-control border border-white/10 bg-black/30 px-3 text-base text-white outline-none placeholder:text-zinc-600 focus:border-accent/40 md:h-10 md:text-sm"
            />
            <Button
              variant="accent"
              size="sm"
              className="min-h-[44px] shrink-0"
              disabled={!name.trim()}
              onClick={async () => {
                await onAddProspect(name);
                setName("");
                setAdding(false);
              }}
            >
              Add
            </Button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="p-10 text-center text-sm text-text-muted">
          {rows.length === 0
            ? "Nobody in the pipeline yet. Add a prospect to start."
            : search.trim()
              ? "Nobody matches that search in this group."
              : "Nobody in this group."}
        </p>
      ) : effectiveView === "list" ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 font-mono text-[0.62rem] uppercase tracking-[0.11em] text-text-muted">
                  {/*
                    Explicit widths on the two narrow columns so Person
                    absorbs the remainder. Without them the browser split
                    1158px evenly-ish across three columns and left a
                    ~200px void between a 160px badge and Last contact -
                    a gap that only appeared once the two task columns
                    were hidden. Found in visual QA, 2026-09-04.
                  */}
                  <th className="px-5 py-3 font-medium">Person</th>
                  <th className="w-[15rem] px-4 py-3 font-medium">Lifecycle</th>
                  <th className="w-[11rem] px-4 py-3 font-medium">
                    Last contact
                  </th>
                  {anyOpenTask && (
                    <>
                      <th className="px-4 py-3 font-medium">Next action</th>
                      <th className="px-5 py-3 font-medium">Follow-up</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.key}
                    tabIndex={0}
                    onClick={() => onOpen(row.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(row.key);
                      }
                    }}
                    className="cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                  >
                    <td className="px-5 py-3.5">
                      <Identity row={row} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StageCell row={row} />
                    </td>
                    <td className="px-4 py-3.5 text-zinc-300">
                      {row.contact ? (
                        relativeDays(row.contact.last_contact_at)
                      ) : (
                        <span className="text-text-muted">&mdash;</span>
                      )}
                    </td>
                    {anyOpenTask && (
                      <>
                        <td className="max-w-[15rem] px-4 py-3.5 text-zinc-300">
                          {nextTaskFor(row)?.title || (
                            <span className="text-text-muted">&mdash;</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {followUpCell(nextTaskFor(row))}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            The mobile directory. Grouped while browsing, flat while
            searching - see `searching` below.
          */}
          <div className="md:hidden">
            {searching ? (
              <ul className="divide-y divide-white/5">
                {visible.map((row) => (
                  <li key={row.key}>
                    <ContactRow
                      row={row}
                      task={nextTaskFor(row)}
                      /* The group is the one thing a flat result loses,
                         so a search result carries it rather than making
                         you work out where the person lives. */
                      groupLabel={GROUP_LABELS[groupFor(row)]}
                      showStage={groupFor(row) === "new_signups"}
                      onOpen={onOpen}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              groups.map((group) => {
                const folded = openGroup !== group.key;
                return (
                  <section key={group.key} className="border-b border-white/5 last:border-0">
                    <h3>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={!folded}
                        aria-controls={`group-${group.key}`}
                        className="flex min-h-[44px] w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                      >
                        <span className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.13em] text-white">
                          {group.label}
                        </span>
                        <span className="font-mono text-[0.66rem] font-bold text-accent">
                          {group.rows.length}
                        </span>
                        <ChevronDown
                          size={16}
                          aria-hidden
                          className={`ml-auto shrink-0 text-text-muted transition ${folded ? "" : "rotate-180"}`}
                        />
                      </button>
                    </h3>

                    <div id={`group-${group.key}`} hidden={folded}>
                      {/* Said once per group rather than once per row. A
                          heading and a number do not explain themselves,
                          and "Onboarding 10" reads as progress or as a
                          problem depending on what you think it means. */}
                      <p className="px-5 pb-3 text-xs leading-relaxed text-text-muted">
                        {group.description}
                      </p>
                      <ul className="divide-y divide-white/5 border-t border-white/5">
                        {group.rows.map((row) => (
                          <li key={row.key}>
                            <ContactRow
                              row={row}
                              task={nextTaskFor(row)}
                              showStage={group.key === "new_signups"}
                              onOpen={onOpen}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                );
              })
            )}
          </div>

        </>
      ) : (
        <div className="p-5">
          {/*
            Read-only by design. Columns are produced by
            resolveLifecycleStage from database truth, so there is no drag
            handle and no drop target anywhere: dragging would mean writing
            a lifecycle stage by hand, which is the drift the whole
            architecture exists to prevent. Cards open the drawer, where
            outreach status - a human judgement - stays editable.
          */}
          <p className="mb-4 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-text-muted">
            Columns move on their own as the product changes. Nothing here is
            draggable.
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 scroll-subtle">
            {FUNNEL_STAGES.map((stage) => {
              const items = byStage.get(stage) ?? [];
              const isGap = stage === "activated" && items.length === 0;
              return (
                <section
                  key={stage}
                  className="w-[13.5rem] shrink-0"
                  aria-label={LIFECYCLE_LABELS[stage]}
                >
                  <header className="flex items-baseline justify-between pb-2.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-muted">
                    <span>{LIFECYCLE_LABELS[stage]}</span>
                    <span
                      className={
                        isGap ? "text-status-declined" : "text-zinc-400"
                      }
                    >
                      {items.length}
                    </span>
                  </header>

                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <p
                        className={`rounded-control border border-dashed p-4 text-center text-xs ${
                          isGap
                            ? "border-status-declined-surface/35 text-status-declined"
                            : "border-white/10 text-text-muted"
                        }`}
                      >
                        {isGap ? "Nobody has got here" : "Empty"}
                      </p>
                    ) : (
                      items.map((row) => {
                        const id = rowIdentity(row);
                        return (
                          <button
                            key={row.key}
                            type="button"
                            onClick={() => onOpen(row.key)}
                            className="w-full rounded-control border border-white/5 bg-white/[0.02] p-3 text-left transition hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                          >
                            <span
                              className={`block truncate text-sm font-semibold text-white ${id.isSlug ? "font-mono text-xs" : ""}`}
                            >
                              {id.primary}
                            </span>
                            {row.contact?.activation_blocker ? (
                              <span className="mt-1 block truncate text-xs text-status-pending">
                                {
                                  BLOCKER_LABELS[
                                    row.contact
                                      .activation_blocker as ActivationBlocker
                                  ]
                                }
                              </span>
                            ) : row.stage === "ready_to_activate" ? (
                              <span className="mt-1 flex items-center gap-1 text-xs text-status-declined">
                                <AlertTriangle size={11} />
                                No blocker recorded
                              </span>
                            ) : row.dj ? (
                              <span className="mt-1 block font-mono text-xs text-text-muted">
                                joined {joinedLabel(row.dj.created_at)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
