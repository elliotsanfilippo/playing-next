"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, AlertTriangle, RefreshCw } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import NotFound from "@/app/not-found";
import { supabase } from "@/src/lib/supabase";
import { adminFetch, adminJson } from "@/src/lib/adminFetch";
import type { LifecycleStage } from "@/src/lib/djLifecycle";
import OverviewView from "@/src/components/admin/OverviewView";
import ContactsView from "@/src/components/admin/ContactsView";
import ReportsView from "@/src/components/admin/ReportsView";
import DjDetailDrawer from "@/src/components/admin/DjDetailDrawer";
import type {
  CrmContact,
  DjStat,
  PipelineRow,
  Report,
} from "@/src/components/admin/crmTypes";

type Destination = "overview" | "contacts" | "reports";

const DESTINATIONS: { key: Destination; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "contacts", label: "Contacts" },
  { key: "reports", label: "Reports" },
];

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  /*
   * Distinct from "authorized" and from an empty list on purpose. A 500
   * used to leave the list empty and render "No DJs yet." - a failed
   * load wearing the costume of a confident answer, the same bug class
   * already fixed on the guest page and the dashboard.
   */
  const [loadFailed, setLoadFailed] = useState(false);

  const [djs, setDjs] = useState<DjStat[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  const [destination, setDestination] = useState<Destination>("overview");
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/admin/login");
        return;
      }

      const [djsResponse, reportsResponse, contactsResponse] =
        await Promise.all([
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
    void (async () => {
      await loadData();
    })();
  }, [loadData]);

  /*
   * The pipeline is a union of accounts and prospects. A prospect has no
   * dj_profiles row at all, which is the case the database could not
   * represent before crm_contacts existed.
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

  const openRow = useMemo(
    () => rows.find((r) => r.key === openRowKey) ?? null,
    [rows, openRowKey]
  );

  const pendingReports = reports.filter((r) => r.resolution === "pending");

  const patchContact = async (
    row: PipelineRow,
    body: Record<string, unknown>,
    message: string
  ) => {
    if (!row.contact) return;
    try {
      await adminJson(
        await adminFetch("/api/admin/crm/contacts", {
          method: "PATCH",
          body: JSON.stringify({ id: row.contact.id, ...body }),
        })
      );
      toast.success(message);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save.");
    }
  };

  const markDone = (row: PipelineRow) =>
    patchContact(
      row,
      { last_contact_at: new Date().toISOString(), next_follow_up_at: null },
      "Marked done."
    );

  const snooze = (row: PipelineRow, days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
    return patchContact(
      row,
      { next_follow_up_at: d.toISOString() },
      days === 1 ? "Snoozed to tomorrow." : `Snoozed ${days} days.`
    );
  };

  /*
   * Called the instant a prospect is linked to an account.
   *
   * The contact stops being its own row and merges into the DJ's, so its
   * key changes from contact:<id> to dj:<profile>. Without this the open
   * drawer pointed at a row that no longer existed and simply vanished,
   * which is what the linking verification caught.
   *
   * The local merge is applied before the refetch rather than after, so
   * the drawer re-renders straight into the linked state instead of
   * flashing "Add CRM context" for the length of a round trip. loadData
   * still runs immediately afterwards and is the authority; this only
   * covers the gap.
   */
  const relinkOpenRow = async (contactId: string, djProfileId: string) => {
    setContacts((current) =>
      current.map((c) =>
        c.id === contactId ? { ...c, dj_profile_id: djProfileId } : c
      )
    );
    setOpenRowKey(`dj:${djProfileId}`);
    await loadData();
  };

  const addProspect = async (name: string) => {
    if (!name.trim()) return;
    try {
      await adminJson(
        await adminFetch("/api/admin/crm/contacts", {
          method: "POST",
          body: JSON.stringify({
            display_name: name,
            outreach_status: "prospect",
          }),
        })
      );
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
      await adminJson(
        await adminFetch("/api/admin/reports/resolve", {
          method: "POST",
          body: JSON.stringify({ reportId, resolution }),
        })
      );
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
      <main
        className="flex min-h-screen items-center justify-center bg-canvas p-6 text-white"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
      >
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

  return (
    <main
      className="min-h-screen bg-canvas text-white"
      /* The bottom bar is fixed, so the page has to reserve its height
         plus whatever the home indicator takes. */
      style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <header
        className="sticky top-0 z-40 border-b border-white/5 bg-canvas/90 backdrop-blur"
        /* statusBarStyle is black-translucent, which deliberately runs
           the page under the status bar. Without this the nav sits
           behind the clock in a standalone Home Screen app. */
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-[75rem] items-center gap-6 px-5 py-3.5">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-accent">
            Admin
          </p>

          <nav className="hidden gap-1 md:flex" aria-label="Admin sections">
            {DESTINATIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDestination(d.key)}
                aria-current={destination === d.key ? "page" : undefined}
                className={`flex items-center gap-2 rounded-control px-3.5 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  destination === d.key
                    ? "bg-white/10 text-white"
                    : "text-text-muted hover:text-white"
                }`}
              >
                {d.label}
                {d.key === "reports" && pendingReports.length > 0 && (
                  <span className="rounded-full bg-status-pending-surface/20 px-1.5 py-0.5 font-mono text-[0.6rem] font-bold text-status-pending">
                    {pendingReports.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <span className="flex-1" />

          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut size={15} className="mr-1.5" />
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[75rem] px-5 py-6 md:pb-10">
        {destination === "overview" && (
          <OverviewView
            rows={rows}
            djs={djs}
            reports={reports}
            onOpen={setOpenRowKey}
            onMarkDone={markDone}
            onSnooze={snooze}
            onGoToReports={() => setDestination("reports")}
          />
        )}

        {destination === "contacts" && (
          <ContactsView
            rows={rows}
            onOpen={setOpenRowKey}
            onAddProspect={addProspect}
          />
        )}

        {destination === "reports" && (
          <ReportsView
            reports={reports}
            resolvingId={resolvingId}
            onResolve={resolveReport}
          />
        )}
      </div>

      {/* Thumb-reachable on mobile, matching how the DJ dashboard puts
          its controls within reach rather than at the top of the page. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-surface-base/95 backdrop-blur md:hidden"
        /* Clears the home indicator. Falls back to 0 in the browser,
           where the bar's own py-3 is enough. */
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Admin sections"
      >
        {DESTINATIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDestination(d.key)}
            aria-current={destination === d.key ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
              destination === d.key ? "text-accent" : "text-text-muted"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {d.label}
              {d.key === "reports" && pendingReports.length > 0 && (
                <span className="rounded-full bg-status-pending-surface/20 px-1.5 font-mono text-[0.6rem] font-bold text-status-pending">
                  {pendingReports.length}
                </span>
              )}
            </span>
          </button>
        ))}
      </nav>

      {openRow && (
        <DjDetailDrawer
          key={openRow.contact?.id ?? openRow.key}
          row={openRow}
          onClose={() => setOpenRowKey(null)}
          onChanged={loadData}
          onLinked={relinkOpenRow}
        />
      )}
    </main>
  );
}
