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
import RetentionPanel from "@/src/components/admin/RetentionPanel";
import PrivacyPanel from "@/src/components/admin/PrivacyPanel";
import TasksView from "@/src/components/admin/TasksView";
import TaskSheet from "@/src/components/admin/TaskSheet";
import FreshnessIndicator from "@/src/components/admin/FreshnessIndicator";
import { rowLabel } from "@/src/lib/djIdentity";
import DjDetailDrawer from "@/src/components/admin/DjDetailDrawer";
import type {
  CrmContact,
  CrmTask,
  DjStat,
  PipelineRow,
  Report,
} from "@/src/components/admin/crmTypes";

type Destination = "overview" | "contacts" | "tasks" | "reports";

const DESTINATIONS: { key: Destination; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "contacts", label: "Contacts" },
  { key: "tasks", label: "Tasks" },
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
  /*
   * Freshness. lastFetchedAt is the moment the visible snapshot was
   * taken; refreshFailed means a background refresh failed while we
   * still hold good data, which must never be shown as if it were
   * current. `now` is captured on each refresh rather than ticked by a
   * timer - see FreshnessIndicator for why.
   */
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [djs, setDjs] = useState<DjStat[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);

  const [destination, setDestination] = useState<Destination>("overview");
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
  const [openMode, setOpenMode] = useState<"detail" | "log">("detail");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  /*
   * One sheet for create, edit and reschedule, opened from Overview,
   * Tasks and the contact drawer. A single instance at page level means
   * the four flows share one control rather than four that drift.
   */
  const [taskSheet, setTaskSheet] = useState<
    { task: CrmTask | null; contactId: string; contactName: string } | null
  >(null);
  const [savingTask, setSavingTask] = useState(false);

  const loadData = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/admin/login");
        return;
      }

      const [djsResponse, reportsResponse, contactsResponse, tasksResponse] =
        await Promise.all([
          adminFetch("/api/admin/djs"),
          adminFetch("/api/admin/reports"),
          adminFetch("/api/admin/crm/contacts"),
          adminFetch("/api/admin/crm/tasks"),
        ]);

      if (
        djsResponse.status === 403 ||
        reportsResponse.status === 403 ||
        contactsResponse.status === 403 ||
        tasksResponse.status === 403
      ) {
        setAuthorized(false);
        setLoadFailed(false);
        setLoading(false);
        return;
      }

      const [djsResult, reportsResult, contactsResult, tasksResult] =
        await Promise.all([
          adminJson<{ djs: DjStat[] }>(djsResponse),
          adminJson<{ reports: Report[] }>(reportsResponse),
          adminJson<{ contacts: CrmContact[] }>(contactsResponse),
          adminJson<{ tasks: CrmTask[] }>(tasksResponse),
        ]);

      setDjs(djsResult.djs ?? []);
      setReports(reportsResult.reports ?? []);
      setContacts(contactsResult.contacts ?? []);
      setTasks(tasksResult.tasks ?? []);
      setAuthorized(true);
      setLoadFailed(false);
      setRefreshFailed(false);
      setLastFetchedAt(Date.now());
      setNow(Date.now());
    } catch (error) {
      if (error instanceof Error && error.message === "NO_SESSION") {
        router.push("/admin/login");
        return;
      }
      /*
       * A failed refresh must not wipe a screen that is still useful.
       * The full failure screen is only correct when there is nothing
       * to fall back on; otherwise keep the last good snapshot and say
       * plainly that it could not be refreshed.
       */
      setNow(Date.now());
      if (background) {
        /* A refresh failing is not a reason to throw away a screen that
           still works. Keep the snapshot, say it is stale. */
        setRefreshFailed(true);
      } else {
        setLoadFailed(true);
        setAuthorized(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      await loadData();
    })();
  }, [loadData]);

  /*
   * Refresh when the app comes back into view.
   *
   * This is an installed Home Screen app: iOS resumes the existing page
   * rather than reloading it, so without this the snapshot could be
   * days old. visibilitychange fires on reopening from the Home Screen,
   * returning from another app, and unlocking the phone - which are
   * exactly the moments the data is about to be read.
   *
   * No polling, no timer, no socket. The 30s floor stops rapid app
   * switching turning into a burst of identical requests.
   */
  useEffect(() => {
    const MIN_INTERVAL_MS = 30_000;

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      if (lastFetchedAt && Date.now() - lastFetchedAt < MIN_INTERVAL_MS) return;
      void loadData(true);
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    /* Re-registered when the timestamp changes, which is once per fetch
       and costs one listener swap. Simpler than a ref, and it cannot
       read a stale value. */
  }, [loadData, lastFetchedAt]);


  /*
   * Primary destinations open at the top.
   *
   * Switching section is React state, not navigation - the URL never
   * changes and there is no router event - so the window keeps whatever
   * scroll position the previous section had. Tapping Contacts from a
   * scrolled Overview landed you 1,200px down a stranger's card. Where
   * it appeared to work it was only the browser clamping to a shorter
   * document, which is luck rather than behaviour.
   *
   * Keyed on `destination` alone. Closing the drawer does not change
   * the destination, so the drawer's own scroll restoration is
   * untouched, and there is no timeout anywhere.
   */
  useEffect(() => {
    /*
     * "instant" on purpose. globals.css sets html { scroll-behavior:
     * smooth } for the marketing page's in-page anchors, which made a
     * section switch animate the whole way up from wherever you were -
     * on a phone that reads as the page flying past you rather than a
     * new screen appearing. A destination change should feel like
     * arriving somewhere, not travelling there.
     */
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [destination]);

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

  /*
   * Later moves only the date of an existing next step. It never invents
   * a task, never touches last_contact_at and never writes history -
   * which is the whole difference between postponing something and
   * pretending it happened.
   */
  const patchTask = async (
    id: string,
    body: Record<string, unknown>,
    message: string
  ) => {
    try {
      await adminJson(
        await adminFetch("/api/admin/crm/tasks", {
          method: "PATCH",
          body: JSON.stringify({ id, ...body }),
        })
      );
      toast.success(message);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save.");
    }
  };

  /* completed_at only. Never last_contact_at, never a note. */
  const completeTask = (task: CrmTask) =>
    patchTask(task.id, { completed_at: new Date().toISOString() }, "Task completed.");

  const reopenTask = (task: CrmTask) =>
    patchTask(task.id, { completed_at: null }, "Task reopened.");

  /* Rescheduling opens the same sheet, so it offers the same choices as
     creating. It still writes due_at and nothing else. */

  const contactNameFor = (contactId: string) => {
    const row = rows.find((r) => r.contact?.id === contactId);
    return row ? rowLabel(row) : "Contact";
  };

  /* Edit and Reschedule are the same sheet on an existing task. */
  const openTaskSheet = (task: CrmTask) =>
    setTaskSheet({
      task,
      contactId: task.contact_id,
      contactName: contactNameFor(task.contact_id),
    });

  const openNewTask = (contactId: string, contactName: string) =>
    setTaskSheet({ task: null, contactId, contactName });

  const saveTaskSheet = async (title: string, dueAt: string | null) => {
    if (!taskSheet) return;
    setSavingTask(true);
    try {
      if (taskSheet.task) {
        /* Editing sends title and due_at only. Nothing else about the
           task, and nothing at all about the contact. */
        await adminJson(
          await adminFetch("/api/admin/crm/tasks", {
            method: "PATCH",
            body: JSON.stringify({ id: taskSheet.task.id, title, due_at: dueAt }),
          })
        );
        toast.success("Task updated.");
      } else {
        await adminJson(
          await adminFetch("/api/admin/crm/tasks", {
            method: "POST",
            body: JSON.stringify({
              contact_id: taskSheet.contactId,
              title,
              due_at: dueAt,
            }),
          })
        );
        toast.success("Task added.");
      }
      setTaskSheet(null);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setSavingTask(false);
    }
  };

  const openRowAt = (key: string, mode: "detail" | "log" = "detail") => {
    setOpenMode(mode);
    setOpenRowKey(key);
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

          <FreshnessIndicator
            lastFetchedAt={lastFetchedAt}
            now={now}
            refreshFailed={refreshFailed}
            refreshing={refreshing}
            onRetry={() => loadData(true)}
          />

          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px]"
            onClick={signOut}
          >
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
            tasks={tasks}
            onOpen={openRowAt}
            onCompleteTask={completeTask}
            onRescheduleTask={openTaskSheet}
            onGoToTasks={() => setDestination("tasks")}
            onGoToReports={() => setDestination("reports")}
          />
        )}

        {destination === "contacts" && (
          <ContactsView
            rows={rows}
            tasks={tasks}
            onOpen={(key) => openRowAt(key)}
            onAddProspect={addProspect}
          />
        )}

        {destination === "tasks" && (
          <TasksView
            tasks={tasks}
            rows={rows}
            onOpenContact={(key) => openRowAt(key)}
            onComplete={completeTask}
            onReopen={reopenTask}
            onReschedule={openTaskSheet}
          />
        )}

        {destination === "reports" && (
          /*
           * Retention sits under Reports rather than becoming a fifth
           * destination: it is a compliance surface consulted a handful
           * of times a year, and a fifth tab would crowd the mobile bar
           * permanently for something used rarely.
           */
          <div className="flex flex-col gap-6">
            <ReportsView
              reports={reports}
              resolvingId={resolvingId}
              onResolve={resolveReport}
            />
            <PrivacyPanel rows={rows} />
            <RetentionPanel />
          </div>
        )}
      </div>

      {/*
        Thumb-reachable on mobile, matching how the DJ dashboard puts its
        controls within reach rather than at the top of the page.

        Removed from the tree entirely while a drawer is open. It sits
        below the drawer in z-order, but on the installed iPhone app it
        still competed with the keyboard, and a section switcher is
        meaningless while you are editing one contact anyway.
      */}
      {!openRow && (
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
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 py-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
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
      )}

      {taskSheet && (
        <TaskSheet
          task={taskSheet.task}
          contactName={taskSheet.contactName}
          saving={savingTask}
          onClose={() => setTaskSheet(null)}
          onSave={saveTaskSheet}
        />
      )}

      {openRow && (
        <DjDetailDrawer
          key={openRow.contact?.id ?? openRow.key}
          row={openRow}
          initialMode={openMode}
          tasks={tasks}
          onCompleteTask={completeTask}
          onReopenTask={reopenTask}
          onRescheduleTask={openTaskSheet}
          onEditTask={openTaskSheet}
          onAddTask={openNewTask}
          onClose={() => setOpenRowKey(null)}
          onChanged={loadData}
          onLinked={relinkOpenRow}
        />
      )}
    </main>
  );
}
