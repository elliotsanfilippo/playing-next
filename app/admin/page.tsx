"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Flag,
  LogOut,
  Search,
  AlertTriangle,
  RefreshCw,
  Plus,
  CalendarClock,
} from "lucide-react";
import Card from "@/src/components/ui/Card";
import Badge from "@/src/components/ui/Badge";
import Button from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";
import NotFound from "@/app/not-found";
import { supabase } from "@/src/lib/supabase";
import { adminFetch, adminJson } from "@/src/lib/adminFetch";
import {
  FUNNEL_STAGES,
  LIFECYCLE_LABELS,
  type LifecycleStage,
} from "@/src/lib/djLifecycle";
import { BLOCKER_LABELS, type ActivationBlocker } from "@/src/lib/crmTaxonomy";
import { stageTone } from "@/src/components/admin/stageTone";
import DjDetailDrawer from "@/src/components/admin/DjDetailDrawer";
import type {
  CrmContact,
  DjStat,
  PipelineRow,
  Report,
} from "@/src/components/admin/crmTypes";

type Segment =
  | "all"
  | "needs_you"
  | "ready_to_activate"
  | "onboarding"
  | "prospects";

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "needs_you", label: "Needs you" },
  { key: "ready_to_activate", label: "Ready to activate" },
  { key: "onboarding", label: "Stuck onboarding" },
  { key: "prospects", label: "Prospects" },
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** A follow-up is due when its date is today or in the past. */
function followUpDue(contact: CrmContact | null) {
  if (!contact?.next_follow_up_at) return false;
  return new Date(contact.next_follow_up_at) <= new Date();
}

function gigWithinDays(contact: CrmContact | null, days: number) {
  if (!contact?.next_gig_date) return false;
  const gig = new Date(contact.next_gig_date);
  const limit = new Date(startOfToday());
  limit.setDate(limit.getDate() + days);
  return gig >= startOfToday() && gig <= limit;
}

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  /*
   * Distinct from "authorized" and from an empty list on purpose. The
   * previous version had no error state at all: a 500 from /api/admin/djs
   * left djs as [] and rendered "No DJs yet.", which is a failed load
   * wearing the costume of a confident answer. Same bug class as the
   * guest page and the dashboard, fixed the same way.
   */
  const [loadFailed, setLoadFailed] = useState(false);

  const [djs, setDjs] = useState<DjStat[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [stageFilter, setStageFilter] = useState<LifecycleStage | null>(null);
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
  const [addingProspect, setAddingProspect] = useState(false);
  const [prospectName, setProspectName] = useState("");

  const loadData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/admin/login");
        return;
      }

      const [djsResponse, reportsResponse, contactsResponse] = await Promise.all([
        adminFetch("/api/admin/djs"),
        adminFetch("/api/admin/reports"),
        adminFetch("/api/admin/crm/contacts"),
      ]);

      if (
        djsResponse.status === 403 ||
        reportsResponse.status === 403 ||
        contactsResponse.status === 403
      ) {
        setAuthorized(false);
        setLoadFailed(false);
        setLoading(false);
        return;
      }

      const [djsResult, reportsResult, contactsResult] = await Promise.all([
        adminJson<{ djs: DjStat[] }>(djsResponse),
        adminJson<{ reports: Report[] }>(reportsResponse),
        adminJson<{ contacts: CrmContact[] }>(contactsResponse),
      ]);

      setDjs(djsResult.djs ?? []);
      setReports(reportsResult.reports ?? []);
      setContacts(contactsResult.contacts ?? []);
      setAuthorized(true);
      setLoadFailed(false);
    } catch (error) {
      if (error instanceof Error && error.message === "NO_SESSION") {
        router.push("/admin/login");
        return;
      }
      setLoadFailed(true);
      setAuthorized(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    /* Wrapped rather than called bare so no state is set synchronously
       during the effect body. */
    void (async () => {
      await loadData();
    })();
  }, [loadData]);

  /*
   * The pipeline is a union of accounts and prospects. A contact linked
   * to a DJ merges into that DJ's row; a contact with no dj_profile_id
   * is a person who exists only here, which dj_profiles cannot represent
   * at all.
   */
  const rows: PipelineRow[] = useMemo(() => {
    const byProfile = new Map<string, CrmContact>();
    for (const c of contacts) {
      if (c.dj_profile_id) byProfile.set(c.dj_profile_id, c);
    }

    const accountRows: PipelineRow[] = djs.map((dj) => ({
      key: `dj:${dj.id}`,
      name: dj.dj_name,
      dj,
      contact: byProfile.get(dj.id) ?? null,
      stage: dj.lifecycle_stage,
    }));

    const prospectRows: PipelineRow[] = contacts
      .filter((c) => !c.dj_profile_id)
      .map((c) => ({
        key: `contact:${c.id}`,
        name: c.display_name,
        dj: null,
        contact: c,
        stage: "prospect" as LifecycleStage,
      }));

    return [...prospectRows, ...accountRows];
  }, [djs, contacts]);

  const pendingReports = useMemo(
    () => reports.filter((r) => r.resolution === "pending"),
    [reports]
  );
  const resolvedReports = useMemo(
    () => reports.filter((r) => r.resolution !== "pending"),
    [reports]
  );

  /* Every row lands in exactly one stage, so these add up to the total. */
  const funnel = useMemo(() => {
    const counts = new Map<LifecycleStage, number>();
    for (const row of rows) {
      counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const needsYou = useMemo(
    () =>
      rows.filter(
        (r) =>
          followUpDue(r.contact) ||
          gigWithinDays(r.contact, 7) ||
          (r.stage === "ready_to_activate" && !r.contact?.activation_blocker)
      ),
    [rows]
  );

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (stageFilter && row.stage !== stageFilter) return false;

      if (segment === "needs_you" && !needsYou.includes(row)) return false;
      if (segment === "ready_to_activate" && row.stage !== "ready_to_activate")
        return false;
      if (segment === "onboarding" && row.stage !== "onboarding_incomplete")
        return false;
      if (segment === "prospects" && row.dj) return false;

      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        (row.dj?.slug ?? "").toLowerCase().includes(query) ||
        (row.contact?.contact_handle ?? "").toLowerCase().includes(query)
      );
    });
  }, [rows, search, segment, stageFilter, needsYou]);

  const openRow = useMemo(
    () => rows.find((r) => r.key === openRowKey) ?? null,
    [rows, openRowKey]
  );

  const addProspect = async () => {
    if (!prospectName.trim()) return;
    try {
      const response = await adminFetch("/api/admin/crm/contacts", {
        method: "POST",
        body: JSON.stringify({
          display_name: prospectName,
          outreach_status: "prospect",
        }),
      });
      await adminJson(response);
      setProspectName("");
      setAddingProspect(false);
      toast.success("Prospect added.");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add.");
    }
  };

  const resolveReport = async (
    reportId: string,
    resolution: "refunded" | "denied"
  ) => {
    if (resolvingId) return;
    setResolvingId(reportId);

    try {
      const response = await adminFetch("/api/admin/reports/resolve", {
        method: "POST",
        body: JSON.stringify({ reportId, resolution }),
      });
      await adminJson(response);
      toast.success(
        resolution === "refunded" ? "Marked as refunded." : "Marked as denied."
      );
      loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update this report."
      );
    } finally {
      setResolvingId(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas text-white">
        <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
      </main>
    );
  }

  /*
   * Renders the site's ordinary 404 rather than a denial message, so
   * stumbling onto this URL does not confirm an admin area exists. The
   * real access control is server-side in every /api/admin/* route.
   */
  if (!authorized) return <NotFound />;

  if (loadFailed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-white">
        <Card variant="elevated" className="max-w-md p-8 text-center">
          <AlertTriangle
            size={28}
            className="mx-auto text-status-pending"
            aria-hidden
          />
          <h1 className="mt-4 text-h3">Admin data could not be loaded</h1>
          <p className="mt-2 text-sm text-text-muted">
            This is a loading failure, not an empty pipeline. Nothing here is
            safe to read as the current state.
          </p>
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => {
              setLoading(true);
              loadData();
            }}
          >
            <RefreshCw size={15} className="mr-1.5" />
            Try again
          </Button>
        </Card>
      </main>
    );
  }

  const liveNow = djs.filter((d) => d.request_status === "taking_requests").length;

  return (
    <main className="min-h-screen bg-canvas p-5 text-white sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Eyebrow tone="accent">Admin</Eyebrow>
            <h1 className="mt-2 text-h1">Pipeline</h1>
            <p className="mt-2 text-text-muted">
              Where every DJ actually is, and who needs you next.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={signOut}
            className="shrink-0"
          >
            <LogOut size={15} className="mr-1.5" />
            Sign Out
          </Button>
        </div>

        <section className="mt-8" aria-label="Funnel">
          <div className="flex gap-2 overflow-x-auto pb-2 scroll-subtle">
            {FUNNEL_STAGES.map((stage) => {
              const count = funnel.get(stage) ?? 0;
              const active = stageFilter === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setStageFilter(active ? null : stage)}
                  aria-pressed={active}
                  className={`min-w-[7.5rem] shrink-0 rounded-card border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    active
                      ? "border-accent/40 bg-accent/10"
                      : "border-white/5 bg-surface-raised hover:border-white/15"
                  }`}
                >
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="mt-1 text-xs leading-tight text-text-muted">
                    {LIFECYCLE_LABELS[stage]}
                  </p>
                </button>
              );
            })}
          </div>
          {stageFilter && (
            <button
              type="button"
              onClick={() => setStageFilter(null)}
              className="mt-1 text-xs text-accent underline underline-offset-2"
            >
              Clear stage filter
            </button>
          )}
        </section>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["In pipeline", String(rows.length)],
            ["Accounts", String(djs.length)],
            ["Live now", String(liveNow)],
            ["Pending reports", String(pendingReports.length)],
          ].map(([term, value], index) => (
            <Card key={term} className="p-4">
              <p className="text-xs text-text-muted">{term}</p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  index === 3 && pendingReports.length > 0
                    ? "text-status-pending"
                    : ""
                }`}
              >
                {value}
              </p>
            </Card>
          ))}
        </div>

        <Card variant="elevated" className="mt-8 p-6">
          <h2 className="text-h3">Needs you today</h2>

          {needsYou.length === 0 && pendingReports.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">
              Nothing waiting. No follow-ups due, no gigs this week and no open
              reports.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {pendingReports.length > 0 && (
                <li className="flex items-center gap-3 rounded-control border border-status-pending-surface/20 bg-status-pending-surface/10 p-3">
                  <Flag size={15} className="shrink-0 text-status-pending" />
                  <span className="text-sm text-zinc-200">
                    {pendingReports.length} not-played report
                    {pendingReports.length === 1 ? "" : "s"} awaiting a decision
                  </span>
                </li>
              )}

              {needsYou.map((row) => {
                const reason = followUpDue(row.contact)
                  ? row.contact?.next_action || "Follow-up due"
                  : gigWithinDays(row.contact, 7)
                    ? `Gig on ${new Date(row.contact!.next_gig_date!).toLocaleDateString()}`
                    : "Ready to activate, no blocker recorded";

                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => setOpenRowKey(row.key)}
                      className="flex w-full items-center justify-between gap-3 rounded-control border border-white/5 bg-white/[0.02] p-3 text-left transition hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-white">
                          {row.name}
                        </span>
                        <span className="block truncate text-sm text-text-muted">
                          {reason}
                        </span>
                      </span>
                      <CalendarClock
                        size={15}
                        className="shrink-0 text-text-muted"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card variant="elevated" className="mt-8 overflow-hidden">
          <div className="space-y-4 border-b border-white/5 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-h3">Pipeline</h2>

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
                    placeholder="Search..."
                    aria-label="Search the pipeline"
                    className="h-10 w-full rounded-control border border-white/10 bg-black/30 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-accent/40"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setAddingProspect((v) => !v)}
                >
                  <Plus size={15} className="mr-1.5" />
                  Prospect
                </Button>
              </div>
            </div>

            {addingProspect && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addProspect();
                    if (e.key === "Escape") setAddingProspect(false);
                  }}
                  placeholder="Their name"
                  aria-label="Prospect name"
                  className="h-10 w-full rounded-control border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-accent/40"
                />
                <Button
                  variant="accent"
                  size="sm"
                  onClick={addProspect}
                  disabled={!prospectName.trim()}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSegment(s.key)}
                  aria-pressed={segment === s.key}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    segment === s.key
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-white/10 bg-white/5 text-text-muted hover:text-white"
                  }`}
                >
                  {s.label}
                  {s.key === "needs_you" && needsYou.length > 0 && (
                    <span className="ml-1.5">{needsYou.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-muted">
              {rows.length === 0
                ? "Nobody in the pipeline yet."
                : "Nobody matches this filter."}
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-text-muted">
                      <th className="px-6 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Stage</th>
                      <th className="px-4 py-3 font-semibold">Blocker</th>
                      <th className="px-4 py-3 font-semibold">Paid</th>
                      <th className="px-4 py-3 font-semibold">Nights</th>
                      <th className="px-4 py-3 font-semibold">Reports</th>
                      <th className="px-6 py-3 font-semibold">Net earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr
                        key={row.key}
                        onClick={() => setOpenRowKey(row.key)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenRowKey(row.key);
                          }
                        }}
                        className="cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-white">{row.name}</p>
                          <p className="text-xs text-text-muted">
                            {row.dj ? row.dj.slug : "No account yet"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge tone={stageTone(row.stage)}>
                            {LIFECYCLE_LABELS[row.stage]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-text-muted">
                          {row.contact?.activation_blocker
                            ? BLOCKER_LABELS[
                                row.contact.activation_blocker as ActivationBlocker
                              ]
                            : "-"}
                        </td>
                        <td className="px-4 py-4 text-zinc-300">
                          {row.dj?.paid_accepted_count ?? "-"}
                        </td>
                        <td className="px-4 py-4 text-zinc-300">
                          {row.dj?.gig_date_count ?? "-"}
                        </td>
                        <td className="px-4 py-4 text-zinc-300">
                          {row.dj?.not_played_reports ?? "-"}
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          {row.dj ? `£${row.dj.net_earnings.toFixed(2)}` : "-"}
                          {(row.dj?.missing_earnings_count ?? 0) > 0 && (
                            <span
                              title={`${row.dj?.missing_earnings_count} captured request(s) predate financial tracking (2026-08-08) and are not in this total.`}
                              className="ml-1.5 inline-flex cursor-help items-center gap-1 text-xs font-semibold text-status-pending"
                            >
                              <AlertTriangle size={12} />
                              incomplete
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-white/5 md:hidden">
                {visibleRows.map((row) => (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => setOpenRowKey(row.key)}
                      className="w-full p-5 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {row.name}
                          </p>
                          <p className="truncate text-xs text-text-muted">
                            {row.dj ? `/${row.dj.slug}` : "No account yet"}
                          </p>
                        </div>
                        <Badge tone={stageTone(row.stage)} className="shrink-0">
                          {LIFECYCLE_LABELS[row.stage]}
                        </Badge>
                      </div>

                      {row.contact?.activation_blocker && (
                        <p className="mt-3 text-sm text-text-muted">
                          {
                            BLOCKER_LABELS[
                              row.contact.activation_blocker as ActivationBlocker
                            ]
                          }
                        </p>
                      )}

                      {row.dj && (
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                          <span>{row.dj.paid_accepted_count} paid</span>
                          <span>{row.dj.gig_date_count} nights</span>
                          <span>£{row.dj.net_earnings.toFixed(2)}</span>
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card variant="elevated" className="mt-8 overflow-hidden">
          <div className="border-b border-white/5 p-6">
            <h2 className="text-h3">
              Not Played Reports{" "}
              {pendingReports.length > 0 && (
                <span className="ml-2 text-sm font-normal text-text-muted">
                  ({pendingReports.length} pending)
                </span>
              )}
            </h2>
          </div>

          <div className="divide-y divide-white/5">
            {reports.length === 0 ? (
              <p className="p-8 text-center text-text-muted">No reports yet.</p>
            ) : (
              [...pendingReports, ...resolvedReports].map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Flag size={14} className="text-text-muted" />
                      <p className="font-semibold text-white">
                        {report.song_requests?.song_title || "Unknown song"}
                      </p>
                      <span className="text-text-muted">
                        {report.song_requests?.artist}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-text-muted">
                      {report.dj_profiles?.dj_name || "Unknown DJ"} ·{" "}
                      {new Date(report.created_at).toLocaleString()}
                    </p>

                    {report.reason && (
                      <p className="mt-2 rounded-control border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                        {report.reason}
                      </p>
                    )}

                    <Badge
                      tone={
                        report.resolution === "pending"
                          ? "warning"
                          : report.resolution === "refunded"
                            ? "accent"
                            : "neutral"
                      }
                      className="mt-3"
                    >
                      {report.resolution}
                    </Badge>
                  </div>

                  {report.resolution === "pending" && (
                    <div className="flex shrink-0 gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => resolveReport(report.id, "denied")}
                        disabled={resolvingId === report.id}
                      >
                        Deny
                      </Button>
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => resolveReport(report.id, "refunded")}
                        disabled={resolvingId === report.id}
                      >
                        Mark Refunded
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {openRow && (
        <DjDetailDrawer
          /* Remounts when a prospect gains a linked contact, so the form
             re-initialises from the row that now exists instead of
             keeping the empty draft it opened with. */
          key={openRow.contact?.id ?? openRow.key}
          row={openRow}
          onClose={() => setOpenRowKey(null)}
          onChanged={loadData}
        />
      )}
    </main>
  );
}
