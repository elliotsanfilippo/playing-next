"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Search, Plus, AlertTriangle } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Badge from "@/src/components/ui/Badge";
import Button from "@/src/components/ui/Button";
import { FUNNEL_STAGES, LIFECYCLE_LABELS, type LifecycleStage } from "@/src/lib/djLifecycle";
import { BLOCKER_LABELS, type ActivationBlocker } from "@/src/lib/crmTaxonomy";
import { displayIdentity, joinedLabel, relativeDays } from "@/src/lib/djIdentity";
import { isInternalDj } from "@/src/lib/internalAccounts";
import { stageTone } from "@/src/components/admin/stageTone";
import { buildQueue, sortForContacts } from "@/src/lib/crmQueue";
import type { CrmContact, PipelineRow } from "@/src/components/admin/crmTypes";

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
const DESKTOP = "(min-width: 768px)";

function subscribe(callback: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => true
  );
}

type View = "list" | "pipeline";

function followUpCell(contact: CrmContact | null) {
  if (!contact?.next_follow_up_at) {
    return <span className="text-text-muted">&mdash;</span>;
  }
  const due = new Date(contact.next_follow_up_at);
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
  const id = displayIdentity(row.dj?.dj_name ?? row.name, row.dj?.slug);
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
  return (
    <>
      <Badge tone={stageTone(row.stage)}>{LIFECYCLE_LABELS[row.stage]}</Badge>
      {row.contact?.activation_blocker && (
        <p className="mt-1 text-xs text-status-pending">
          {BLOCKER_LABELS[row.contact.activation_blocker as ActivationBlocker]}
        </p>
      )}
    </>
  );
}

export default function ContactsView({
  rows,
  onOpen,
  onAddProspect,
}: {
  rows: PipelineRow[];
  onOpen: (key: string) => void;
  onAddProspect: (name: string) => Promise<void>;
}) {
  const [view, setView] = useState<View>("list");
  const isDesktop = useIsDesktop();
  /* Pipeline is never rendered narrow, whatever the toggle last held. */
  const effectiveView: View = isDesktop ? view : "list";
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const ordered = useMemo(
    () => sortForContacts(rows, buildQueue(rows)),
    [rows]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.dj?.slug ?? "").toLowerCase().includes(q) ||
        (r.contact?.contact_handle ?? "").toLowerCase().includes(q)
    );
  }, [ordered, search]);

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
                onChange={(e) => setSearch(e.target.value)}
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
            : "Nobody matches that search."}
        </p>
      ) : effectiveView === "list" ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 font-mono text-[0.62rem] uppercase tracking-[0.11em] text-text-muted">
                  <th className="px-5 py-3 font-medium">Person</th>
                  <th className="px-4 py-3 font-medium">Lifecycle</th>
                  <th className="px-4 py-3 font-medium">Last contact</th>
                  <th className="px-4 py-3 font-medium">Next action</th>
                  <th className="px-5 py-3 font-medium">Follow-up</th>
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
                    <td className="max-w-[15rem] px-4 py-3.5 text-zinc-300">
                      {row.contact?.next_action || (
                        <span className="text-text-muted">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{followUpCell(row.contact)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-white/5 md:hidden">
            {visible.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => onOpen(row.key)}
                  className="w-full p-5 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Identity row={row} />
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={stageTone(row.stage)}>
                        {LIFECYCLE_LABELS[row.stage]}
                      </Badge>
                    </div>
                  </div>

                  {row.contact?.activation_blocker && (
                    <p className="mt-2.5 text-sm text-status-pending">
                      {
                        BLOCKER_LABELS[
                          row.contact.activation_blocker as ActivationBlocker
                        ]
                      }
                    </p>
                  )}

                  {row.contact?.next_action && (
                    <p className="mt-2.5 text-sm text-zinc-300">
                      {row.contact.next_action}
                    </p>
                  )}

                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-text-muted">
                    <span>
                      last contact{" "}
                      {row.contact
                        ? relativeDays(row.contact.last_contact_at).toLowerCase()
                        : "never"}
                    </span>
                    {row.contact?.next_follow_up_at && (
                      <span>follow-up {followUpCell(row.contact)}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
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
                        const id = displayIdentity(
                          row.dj?.dj_name ?? row.name,
                          row.dj?.slug
                        );
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
