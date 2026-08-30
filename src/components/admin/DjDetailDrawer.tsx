"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  X,
  Trash2,
  Link2,
  Check,
  Clock,
  Plus,
  AlertTriangle,
  MessageSquarePlus,
} from "lucide-react";
import Button from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";
import { useModalA11y } from "@/src/lib/useModalA11y";
import {
  useVisualViewport,
  useKeepFocusVisible,
} from "@/src/lib/useVisualViewport";
import { adminFetch, adminJson } from "@/src/lib/adminFetch";
import { displayIdentity, rowIdentity, joinedLabel, relativeDays } from "@/src/lib/djIdentity";
import { isInternalDj } from "@/src/lib/internalAccounts";
import {
  ACQUISITION_SOURCES,
  ACTIVATION_BLOCKERS,
  BLOCKER_LABELS,
  OUTREACH_LABELS,
  OUTREACH_OFFERED,
  type OutreachStatus,
  type ActivationBlocker,
} from "@/src/lib/crmTaxonomy";
import { stageTone } from "@/src/components/admin/stageTone";
import ContactIdentity from "@/src/components/admin/ContactIdentity";
import LogInteractionForm, {
  type LogPayload,
} from "@/src/components/admin/LogInteractionForm";
import { MoreDetails, SectionLabel } from "@/src/components/admin/DrawerSections";
import { buildActivity, activityDate } from "@/src/lib/crmActivity";
import { taskDueLabel, classifyTask } from "@/src/lib/crmQueue";

import type {
  CrmContact,
  CrmNote,
  CrmTask,
  PipelineRow,
  UnlinkedDj,
  UnlinkedContact,
} from "@/src/components/admin/crmTypes";

/*
 * text-base, not text-sm. iOS Safari zooms the page whenever a form
 * control smaller than 16px receives focus, and then leaves it zoomed
 * after the keyboard closes - which is exactly the "slightly zoomed in"
 * symptom reported from the installed app. Fixing the font size is the
 * correct fix; suppressing it with maximum-scale would take pinch-zoom
 * away from the whole Admin.
 *
 * h-12 keeps every control at or above the 44px touch minimum.
 */
const field =
  "h-12 w-full rounded-control border border-white/10 bg-black/30 px-3 text-base text-white outline-none placeholder:text-zinc-600 focus:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/30 md:h-11 md:text-sm";
const sectionLabel =
  "font-mono text-[0.62rem] font-semibold uppercase tracking-[0.13em]";

function dateInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export default function DjDetailDrawer({
  row,
  onClose,
  onChanged,
  onLinked,
  initialMode = "detail",
  tasks,
  onCompleteTask,
  onReopenTask,
  onRescheduleTask,
  onEditTask,
  onAddTask,
}: {
  row: PipelineRow;
  onClose: () => void;
  onChanged: () => void;
  /* Lets the parent move the open drawer onto the merged row rather
     than letting it unmount when the prospect's key disappears. */
  onLinked?: (contactId: string, djProfileId: string) => Promise<void>;
  /** Overview's Log button opens the drawer straight into the log flow. */
  initialMode?: "detail" | "log";
  tasks: CrmTask[];
  onCompleteTask: (task: CrmTask) => void;
  onReopenTask: (task: CrmTask) => void;
  onRescheduleTask: (task: CrmTask) => void;
  onEditTask: (task: CrmTask) => void;
  onAddTask: (contactId: string, contactName: string) => void;
}) {
  const { containerRef, dialogProps } = useModalA11y({ open: true, onClose });
  const viewport = useVisualViewport();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useKeepFocusVisible(scrollerRef, viewport.keyboardOpen);

  const contact = row.contact;
  const dj = row.dj;

  /*
   * The five manual states, plus the stored value when it is one of the
   * two retired ones. Without that second half, opening a contact whose
   * status is "signed_up" would show the select sitting on a different
   * value and Save changes would quietly rewrite it - which is the
   * "a form that does not show a field must never write it" rule
   * failing in its other direction.
   */
  const offeredStatuses = useMemo(() => {
    const stored = contact?.outreach_status as OutreachStatus | undefined;
    const list = [...OUTREACH_OFFERED] as OutreachStatus[];
    return stored && !list.includes(stored) ? [stored, ...list] : list;
  }, [contact?.outreach_status]);
  const identity = rowIdentity(row);

  /*
   * The saved state of every field this form is allowed to write, in one
   * place. Save compares against it, the re-sync restores from it, and
   * the two therefore cannot disagree about what "unchanged" means.
   */
  const baseline = useMemo(
    () => ({
      outreach_status: contact?.outreach_status ?? "prospect",
      activation_blocker: contact?.activation_blocker ?? "",
      acquisition_source: contact?.acquisition_source ?? "",
      contact_channel: contact?.contact_channel ?? "",
      contact_handle: contact?.contact_handle ?? "",
      next_gig_date: dateInput(contact?.next_gig_date ?? null),
    }),
    [contact]
  );

  const [draft, setDraft] = useState(baseline);

  /*
   * Re-sync the draft when the contact changes underneath the open
   * drawer - which happens every time Log writes. Without this the
   * blocker select would keep showing the value from when the drawer
   * opened and Save details would write that stale value back, which is
   * the same bug the next step had.
   *
   * Adjusting state during render rather than in an effect: this is
   * React's documented pattern for deriving state from changed props,
   * and it avoids the extra render an effect would cause.
   */
  const [syncedAt, setSyncedAt] = useState(contact?.updated_at);
  if (contact && contact.updated_at !== syncedAt) {
    setSyncedAt(contact.updated_at);
    setDraft(baseline);
  }

  /*
   * Whether the sticky Save has anything to do. Compared field by field
   * against what is saved, so reopening a drawer and changing nothing
   * leaves the button disabled and no write happens at all.
   */
  const dirty = (Object.keys(baseline) as (keyof typeof baseline)[]).some(
    (key) => draft[key] !== baseline[key]
  );

  const [gigEditing, setGigEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [notesFailed, setNotesFailed] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [mode, setMode] = useState<"detail" | "log">(
    initialMode === "log" && contact ? "log" : "detail"
  );

  /* Linking */
  const [linking, setLinking] = useState(false);
  const [candidates, setCandidates] = useState<UnlinkedDj[] | null>(null);
  const [candidatesFailed, setCandidatesFailed] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [chosen, setChosen] = useState<UnlinkedDj | null>(null);

  /* The same flow from the account side, for a New signup. */
  const [linkingProspect, setLinkingProspect] = useState(false);
  const [prospects, setProspects] = useState<UnlinkedContact[] | null>(null);
  const [prospectsFailed, setProspectsFailed] = useState(false);
  const [prospectQuery, setProspectQuery] = useState("");
  const [chosenProspect, setChosenProspect] = useState<UnlinkedContact | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!contact) {
        if (!cancelled) setNotes([]);
        return;
      }
      try {
        const response = await adminFetch(
          `/api/admin/crm/notes?contact_id=${contact.id}`
        );
        const result = await adminJson<{ notes: CrmNote[] }>(response);
        if (!cancelled) {
          setNotes(result.notes);
          setNotesFailed(false);
        }
      } catch {
        if (!cancelled) setNotesFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contact]);

  useEffect(() => {
    if (!linking) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await adminFetch("/api/admin/crm/unlinked-djs");
        const result = await adminJson<{ djs: UnlinkedDj[] }>(response);
        if (!cancelled) {
          setCandidates(result.djs);
          setCandidatesFailed(false);
        }
      } catch {
        if (!cancelled) setCandidatesFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linking]);

  useEffect(() => {
    if (!linkingProspect) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await adminFetch("/api/admin/crm/unlinked-contacts");
        const result = await adminJson<{ contacts: UnlinkedContact[] }>(
          response
        );
        if (!cancelled) {
          setProspects(result.contacts);
          setProspectsFailed(false);
        }
      } catch {
        /* A failed load must not render as "no prospects match". */
        if (!cancelled) setProspectsFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkingProspect]);

  /*
   * Plain substring filtering on what the admin typed, over name,
   * channel and handle. This is a search box, not a suggester: it never
   * ranks, never scores and never proposes a match of its own.
   */
  const prospectMatches = useMemo(() => {
    if (!prospects) return [];
    const q = prospectQuery.trim().toLowerCase();
    const list = q
      ? prospects.filter(
          (c) =>
            c.display_name.toLowerCase().includes(q) ||
            (c.contact_handle ?? "").toLowerCase().includes(q) ||
            (c.contact_channel ?? "").toLowerCase().includes(q)
        )
      : prospects;
    return list.slice(0, 8);
  }, [prospects, prospectQuery]);

  const matches = useMemo(() => {
    if (!candidates) return [];
    const q = linkQuery.trim().toLowerCase();
    const list = q
      ? candidates.filter(
          (c) =>
            c.dj_name.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q)
        )
      : candidates;
    return list.slice(0, 8);
  }, [candidates, linkQuery]);

  const patch = async (body: Record<string, unknown>, message: string) => {
    if (!contact) return;
    setSaving(true);
    try {
      const response = await adminFetch("/api/admin/crm/contacts", {
        method: "PATCH",
        body: JSON.stringify({ id: contact.id, ...body }),
      });
      await adminJson<{ contact: CrmContact }>(response);
      toast.success(message);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  /*
   * Deliberately does NOT write next_action or next_follow_up_at.
   *
   * It used to, from a draft captured when the drawer opened and never
   * re-synced - and the form stopped rendering inputs for either field,
   * so they were write-only from a value nobody could see. Logging an
   * interaction set a next step correctly, and then tapping Save details
   * wrote null over both. Proven end to end on a temporary contact: the
   * step survived the log and the refetch, and was destroyed by Save.
   *
   * The next step belongs to Log, Done and Later now. A form that does
   * not show a field must never write it.
   */
  const save = () => {
    if (!dirty) return;
    return patch(
      {
        outreach_status: draft.outreach_status,
        activation_blocker: draft.activation_blocker || null,
        acquisition_source: draft.acquisition_source || null,
        contact_channel: draft.contact_channel || null,
        contact_handle: draft.contact_handle || null,
        next_gig_date: draft.next_gig_date || null,
      },
      "Changes saved."
    );
  };

  /*
   * Done finishes a task of mine. It clears the step and its date and
   * writes nothing else - in particular not last_contact_at, because
   * ticking something off is not contact. That conflation is what made
   * the old button claim you had spoken to someone you had not.
   *
   * No history is written either. 14 of the 23 imported contacts carry
   * boilerplate next actions like "Follow up", and auto-noting those
   * would bury the real history under entries nobody wrote.
   */
  /*
   * Creating a task is its own act. It must never require inventing an
   * interaction first, which is why + Task exists here as well as
   * inside the log flow.
   */
  /* Opens the shared sheet so + Task offers exactly the same choices as
     Edit, Reschedule and the log flow's "what next?" step. */
  const promptTask = () => {
    if (!contact) return;
    onAddTask(contact.id, row.name);
  };

  /*
   * A note without contact. Recording that a venue said no last month
   * is history, not a conversation you had today - so this explicitly
   * does not advance last_contact_at.
   */
  const addHistoricalNote = async () => {
    const body = window.prompt("Note (history, not a new interaction)");
    if (!body?.trim() || !contact) return;
    setSaving(true);
    try {
      await adminJson(
        await adminFetch("/api/admin/crm/notes", {
          method: "POST",
          body: JSON.stringify({
            contact_id: contact.id,
            body,
            advance_last_contact: false,
          }),
        })
      );
      toast.success("Note added.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add.");
    } finally {
      setSaving(false);
    }
  };

  /* The one action that writes history, and the only one that advances
     last_contact_at, because an interaction genuinely is contact. */
  const logInteraction = async (payload: LogPayload) => {
    if (!contact) return;
    setSaving(true);
    try {
      await adminJson(
        await adminFetch("/api/admin/crm/notes", {
          method: "POST",
          body: JSON.stringify({
            contact_id: contact.id,
            body: payload.note,
            /* This one genuinely is contact. */
            advance_last_contact: true,
          }),
        })
      );

      /*
       * next_action and next_follow_up_at are deliberately absent. A
       * follow-up from a logged interaction is a real crm_tasks row,
       * the same object + Task creates. The legacy columns stay in the
       * database untouched as rollback data and are written by nothing.
       */
      const fields: Record<string, unknown> = {
        last_contact_at: new Date().toISOString(),
      };
      if (payload.blockerChanged) fields.activation_blocker = payload.blocker;

      await adminJson(
        await adminFetch("/api/admin/crm/contacts", {
          method: "PATCH",
          body: JSON.stringify({ id: contact.id, ...fields }),
        })
      );

      if (payload.nextAction.trim()) {
        await adminJson(
          await adminFetch("/api/admin/crm/tasks", {
            method: "POST",
            body: JSON.stringify({
              contact_id: contact.id,
              title: payload.nextAction,
              due_at: payload.nextDate || null,
            }),
          })
        );
      }

      toast.success("Interaction logged.");
      setMode("detail");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  const createContact = async () => {
    if (!dj) return;
    setSaving(true);
    try {
      const response = await adminFetch("/api/admin/crm/contacts", {
        method: "POST",
        /*
         * Deliberately does not send outreach_status. Adding CRM context
         * to an account is not a statement about the relationship, and
         * "signed up" is already true and already visible from the
         * lifecycle. The column keeps its own default.
         */
        body: JSON.stringify({
          display_name: dj.dj_name,
          dj_profile_id: dj.id,
        }),
      });
      await adminJson<{ contact: CrmContact }>(response);
      toast.success("CRM context added.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add.");
    } finally {
      setSaving(false);
    }
  };

  /*
   * ── The link, in one place ─────────────────────────────────────
   *
   * Reached from both directions: from a prospect picking the account
   * they signed up with, and from a new signup picking the prospect it
   * turns out to be. They are the same claim about identity made from
   * opposite ends, so they are the same write - one PATCH attaching
   * dj_profile_id to the contact, and nothing else.
   *
   * Nothing here touches notes, tasks, the blocker, the outreach status
   * or any other relationship field. They all hang off contact_id and
   * survive untouched precisely because this does not go near them;
   * that is what makes linking safe rather than a merge. From the
   * moment it lands, the Playing Next lifecycle for the account is what
   * the resolver says it is.
   */
  const performLink = async (
    contactId: string,
    djProfileId: string,
    message: string
  ) => {
    setSaving(true);
    try {
      const response = await adminFetch("/api/admin/crm/contacts", {
        method: "PATCH",
        body: JSON.stringify({ id: contactId, dj_profile_id: djProfileId }),
      });
      await adminJson<{ contact: CrmContact }>(response);
      toast.success(message);
      setLinking(false);
      setChosen(null);
      setLinkingProspect(false);
      setChosenProspect(null);

      if (onLinked) {
        await onLinked(contactId, djProfileId);
        /*
         * The button this click came from has just been removed from the
         * DOM along with the panel around it, so focus would otherwise
         * fall to <body>. onLinked already moved the drawer onto the
         * merged row; putting focus back on the panel keeps a keyboard
         * user where they were.
         */
        containerRef.current?.focus();
      } else {
        onChanged();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to link this contact."
      );
    } finally {
      setSaving(false);
    }
  };

  /* Prospect side: this contact, the account they picked. */
  const linkToDj = () => {
    if (!contact || !chosen) return;
    return performLink(contact.id, chosen.id, `Linked to ${chosen.dj_name}.`);
  };

  /* Account side: this account, the prospect they picked. */
  const linkToProspect = () => {
    if (!dj || !chosenProspect) return;
    return performLink(
      chosenProspect.id,
      dj.id,
      `Linked to ${chosenProspect.display_name}.`
    );
  };


  const removeContact = async () => {
    if (!contact) return;
    setSaving(true);
    try {
      const response = await adminFetch(
        `/api/admin/crm/contacts?id=${contact.id}`,
        { method: "DELETE" }
      );
      await adminJson(response);
      toast.success("CRM context removed.");
      onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove.");
    } finally {
      setSaving(false);
    }
  };


  const deleteNote = async (id: string) => {
    try {
      await adminJson(
        await adminFetch(`/api/admin/crm/notes?id=${id}`, { method: "DELETE" })
      );
      setNotes((current) => current.filter((n) => n.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete.");
    }
  };

  const derived: [string, string][] = dj
    ? [
        ["Onboarding", dj.onboarding_complete ? "Complete" : "Incomplete"],
        ["Payments", dj.stripe_connected ? "Ready" : "Not ready"],
        ["Paid requests", String(dj.paid_accepted_count)],
        ["Gig nights", String(dj.gig_date_count)],
        ["Net earnings", `£${dj.net_earnings.toFixed(2)}`],
        ["Plan", dj.plan || "free"],
      ]
    : [];

  /* This contact's tasks, open first and soonest due first. The list is
     a list: there is no structural limit of one, which was the whole
     point of moving off next_action. */
  const contactTasks = useMemo(
    () => tasks.filter((t) => contact && t.contact_id === contact.id),
    [tasks, contact]
  );
  const openTasks = useMemo(
    () =>
      contactTasks
        .filter((t) => !t.completed_at)
        .sort((a, b) => {
          if (!a.due_at && !b.due_at) return 0;
          if (!a.due_at) return 1;
          if (!b.due_at) return -1;
          return a.due_at < b.due_at ? -1 : 1;
        }),
    [contactTasks]
  );
  const activity = useMemo(
    () => buildActivity(row, notes, contactTasks),
    [row, notes, contactTasks]
  );

  const blockerLabel = contact?.activation_blocker
    ? BLOCKER_LABELS[contact.activation_blocker as ActivationBlocker]
    : null;

  return (
    <div
      className="fixed inset-x-0 z-50 flex justify-end"
      style={{
        top: viewport.height ? `${viewport.offsetTop}px` : 0,
        height: viewport.height ? `${viewport.height}px` : "100dvh",
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        {...dialogProps("crm-drawer-title")}
        className="relative flex h-full w-full max-w-[46rem] flex-col border-l border-white/10 bg-surface-base shadow-2xl shadow-black/60"
      >
        {/* ── At a glance ───────────────────────────────────────── */}
        <header
          className="border-b border-white/5 p-5"
          style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="crm-drawer-title" className="min-w-0 flex-1">
              <ContactIdentity row={row} />
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <X size={18} />
            </button>
          </div>

          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-text-muted">
            {/*
              The slug, whenever it is not already the heading. A DJ who
              never named themselves now shows as the name you recorded
              during outreach, which is the better heading but loses the
              one identifier that is the address of their request page.
              It belongs here as context rather than as a title.
            */}
            {dj && !identity.isSlug && (
              <>
                <span>/{dj.slug}</span>
                <span aria-hidden>·</span>
              </>
            )}
            {dj ? `joined ${joinedLabel(dj.created_at)}` : "No account yet"}
            {contact && (
              <>
                <span aria-hidden>·</span>
                <span>last contact {relativeDays(contact.last_contact_at).toLowerCase()}</span>
              </>
            )}
          </p>

          {blockerLabel && (
            <p className="mt-2 text-sm text-status-pending">{blockerLabel}</p>
          )}
        </header>

        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto scroll-subtle [overscroll-behavior:contain]"
        >
          {mode === "log" && contact ? (
            <LogInteractionForm
              contact={contact}
              saving={saving}
              onCancel={() => setMode("detail")}
              onSave={logInteraction}
            />
          ) : contact ? (
            <>
              {/* ── What happens next ─────────────────────────── */}
              <section className="border-b border-white/5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel>
                    Tasks{openTasks.length > 0 && ` · ${openTasks.length} open`}
                  </SectionLabel>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={promptTask}
                    disabled={saving}
                  >
                    <Plus size={14} className="mr-1.5" />
                    Task
                  </Button>
                </div>

                {openTasks.length === 0 ? (
                  <p className="mt-2.5 text-sm text-text-muted">
                    Nothing to do for this person. Add a task when you decide
                    on one - being blocked or awaiting a reply is state, not a
                    task.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {openTasks.map((task, index) => {
                      const tier = classifyTask(task);
                      return (
                        <li
                          key={task.id}
                          className={`rounded-control border p-3 ${
                            index === 0
                              ? "border-white/15 bg-white/[0.04]"
                              : "border-white/5 bg-white/[0.02]"
                          }`}
                        >
                          <p className="text-sm font-semibold text-white">
                            {task.title}
                          </p>
                          <p
                            className={`mt-1 font-mono text-xs ${
                              tier === "overdue"
                                ? "text-status-declined"
                                : tier === "today"
                                  ? "text-status-pending"
                                  : "text-text-muted"
                            }`}
                          >
                            {taskDueLabel(task)}
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="min-h-[44px]"
                              onClick={() => onCompleteTask(task)}
                            >
                              <Check size={14} className="mr-1.5" />
                              Complete
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-[44px]"
                              onClick={() => onRescheduleTask(task)}
                            >
                              <Clock size={14} className="mr-1.5" />
                              Reschedule
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-[44px]"
                              onClick={() => onEditTask(task)}
                            >
                              Edit
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Quick actions. Log is the only one that records
                    contact; the other two never touch last_contact_at. */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="accent"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setMode("log")}
                    disabled={saving}
                  >
                    <MessageSquarePlus size={14} className="mr-1.5" />
                    Log interaction
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={addHistoricalNote}
                    disabled={saving}
                  >
                    <Plus size={14} className="mr-1.5" />
                    Note
                  </Button>
                </div>
              </section>

              {/* ── Activity ──────────────────────────────────── */}
              <section className="border-b border-white/5 p-5">
                <SectionLabel>Activity</SectionLabel>

                {notesFailed ? (
                  <p className="mt-3 rounded-control border border-status-declined-surface/20 bg-status-declined-surface/10 p-3 text-sm text-status-declined">
                    History could not be loaded. This is not the same as there
                    being none.
                  </p>
                ) : activity.length === 0 ? (
                  <p className="mt-2.5 text-sm text-text-muted">
                    Nothing recorded yet.
                  </p>
                ) : (
                  <ol className="mt-4 space-y-3 border-l border-white/10 pl-4">
                    {activity.map((entry) => (
                      <li key={entry.id} className="relative">
                        {/* A dot per source, not a rainbow: green for
                            things you did, blue for things the product
                            did. */}
                        <span
                          aria-hidden
                          className={`absolute -left-[1.32rem] top-1.5 h-2 w-2 rounded-full ${
                            entry.kind === "product"
                              ? "bg-status-playing"
                              : "bg-accent"
                          }`}
                        />
                        <p className="text-sm text-zinc-200">
                          {entry.kind === "task" && (
                            <span className="text-text-muted">Task completed: </span>
                          )}
                          {entry.detail ?? entry.title}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-text-muted">
                          {activityDate(entry)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {/* ── More details ─────────────────────────────── */}
              <MoreDetails title="Product activity">
                {dj ? (
                  <>
                    <dl className="grid grid-cols-2 gap-2">
                      {derived.map(([term, value]) => (
                        <div
                          key={term}
                          className="rounded-control border border-white/5 bg-white/[0.02] p-3"
                        >
                          <dt className="text-xs text-text-muted">{term}</dt>
                          <dd className="mt-0.5 text-sm font-semibold text-white">
                            {value}
                          </dd>
                        </div>
                      ))}
                      <div className="rounded-control border border-white/5 bg-white/[0.02] p-3">
                        <dt className="text-xs text-text-muted">Not-played reports</dt>
                        <dd className={`mt-0.5 text-sm font-semibold ${dj.not_played_reports > 0 ? "text-status-pending" : "text-white"}`}>
                          {dj.not_played_reports}
                        </dd>
                      </div>
                      <div className="rounded-control border border-white/5 bg-white/[0.02] p-3">
                        <dt className="text-xs text-text-muted">Dispute rate</dt>
                        <dd className={`mt-0.5 text-sm font-semibold ${dj.dispute_rate > 0.1 ? "text-status-declined" : "text-white"}`}>
                          {(dj.dispute_rate * 100).toFixed(1)}%
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-text-muted">
                      Read from the product. Not editable, and never stored in
                      the CRM.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-text-muted">
                    No Playing Next account yet. Nothing to derive until they
                    sign up and this contact is linked to their profile.
                  </p>
                )}
              </MoreDetails>

              <MoreDetails title="Relationship details">
                <div className="space-y-3.5">
                  <div>
                    <label className="text-sm text-zinc-300" htmlFor="blocker">
                      Activation blocker
                    </label>
                    <select
                      id="blocker"
                      className={`${field} mt-1.5`}
                      value={draft.activation_blocker}
                      onChange={(e) =>
                        setDraft({ ...draft, activation_blocker: e.target.value })
                      }
                    >
                      <option value="" className="bg-zinc-900">
                        None recorded
                      </option>
                      {ACTIVATION_BLOCKERS.map((b) => (
                        <option key={b} value={b} className="bg-zinc-900">
                          {BLOCKER_LABELS[b]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/*
                    Manual context, and nothing writes it but this
                    control. A bare <input type="date"> was doing the
                    opposite of saying so: empty, it still renders as a
                    filled-looking field, and tapping it opens a wheel
                    sitting on today - so an unset gig read as a date
                    somebody had recorded. Checked against Production on
                    2026-08-30: no contact has ever had a next_gig_date.
                    Nothing was wrong with the data; the control was
                    lying about it.
                  */}
                  <div>
                    <p className="text-sm text-zinc-300" id="gig-label">
                      Next gig
                    </p>
                    {draft.next_gig_date || gigEditing ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <input
                          id="gig"
                          type="date"
                          aria-labelledby="gig-label"
                          autoFocus={gigEditing && !draft.next_gig_date}
                          className={`${field} min-w-0 flex-1`}
                          value={draft.next_gig_date}
                          onChange={(e) =>
                            setDraft({ ...draft, next_gig_date: e.target.value })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={() => {
                            setGigEditing(false);
                            setDraft({ ...draft, next_gig_date: "" });
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <span className="text-sm text-text-muted">
                          No date set
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={() => setGigEditing(true)}
                        >
                          Set date
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-zinc-300" htmlFor="source">
                      Where they came from
                    </label>
                    <input
                      id="source"
                      list="acquisition-sources"
                      className={`${field} mt-1.5`}
                      placeholder="Direct outreach, Instagram, referral..."
                      value={draft.acquisition_source}
                      onChange={(e) =>
                        setDraft({ ...draft, acquisition_source: e.target.value })
                      }
                    />
                    <datalist id="acquisition-sources">
                      {ACQUISITION_SOURCES.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    <p className="mt-1.5 text-xs text-text-muted">
                      Your own record. Automated attribution will never
                      overwrite this.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-zinc-300" htmlFor="channel">
                        Channel
                      </label>
                      <input
                        id="channel"
                        className={`${field} mt-1.5`}
                        placeholder="Instagram"
                        value={draft.contact_channel}
                        onChange={(e) =>
                          setDraft({ ...draft, contact_channel: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-300" htmlFor="handle">
                        Handle
                      </label>
                      <input
                        id="handle"
                        className={`${field} mt-1.5`}
                        placeholder="@name"
                        value={draft.contact_handle}
                        onChange={(e) =>
                          setDraft({ ...draft, contact_handle: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-zinc-300" htmlFor="outreach">
                      Outreach status
                    </label>
                    <select
                      id="outreach"
                      className={`${field} mt-1.5`}
                      value={draft.outreach_status}
                      onChange={(e) =>
                        setDraft({ ...draft, outreach_status: e.target.value })
                      }
                    >
                      {offeredStatuses.map((s) => (
                        <option key={s} value={s} className="bg-zinc-900">
                          {OUTREACH_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-text-muted">
                      {dj
                        ? "Whether they signed up is answered by Playing Next above. This is the relationship, which only you know."
                        : "Where this relationship stands. Only you know this, so nothing sets it automatically."}
                    </p>
                  </div>

                  <p className="text-xs text-text-muted">
                    Saved with Save changes at the bottom of this panel.
                  </p>
                </div>
              </MoreDetails>

              <MoreDetails title="Admin">
                {confirmingDelete ? (
                  <div className="rounded-card border border-status-declined-surface/25 bg-status-declined-surface/[0.07] p-4">
                    <p className="flex items-start gap-2 text-sm font-semibold text-white">
                      <AlertTriangle
                        size={16}
                        className="mt-0.5 shrink-0 text-status-declined"
                      />
                      Remove the CRM context for {row.name}?
                    </p>
                    <ul className="mt-2 ml-6 list-disc space-y-1 text-sm text-text-muted">
                      <li>
                        {notes.length} history entr{notes.length === 1 ? "y" : "ies"} will be deleted
                      </li>
                      <li>
                        The DJ&rsquo;s account, requests and earnings are{" "}
                        <strong className="text-zinc-200">not</strong> touched
                      </li>
                    </ul>
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={removeContact}
                        disabled={saving}
                      >
                        Remove context
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => setConfirmingDelete(false)}
                      >
                        Keep it
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-control px-3 text-sm text-text-muted transition hover:text-status-declined focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <Trash2 size={14} />
                    Remove CRM context
                  </button>
                )}
              </MoreDetails>
            </>
          ) : (
            /* No CRM context yet, or an unlinked prospect */
            <div className="space-y-6 p-5">
              {dj ? (
                /*
                 * A New signup, seen from the account side. The inbox is
                 * worked down to zero through exactly these two doors:
                 * this account is somebody new, or this account is a
                 * prospect already in the CRM. Either way it leaves the
                 * inbox the moment a contact points at it, and the
                 * lifecycle resolver takes over from there.
                 */
                <section className="rounded-card border border-white/5 bg-white/[0.02] p-5">
                  <p className="text-sm text-zinc-300">
                    This account is not in your CRM yet.
                  </p>
                  <p className="mt-1.5 text-sm text-text-muted">
                    Reconcile it and it moves out of New signups into
                    whichever lifecycle group Playing Next says it is in.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={createContact}
                      disabled={saving}
                    >
                      <Plus size={15} className="mr-1.5" />
                      Add as new contact
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => setLinkingProspect((v) => !v)}
                      aria-expanded={linkingProspect}
                      disabled={saving}
                    >
                      <Link2 size={15} className="mr-1.5" />
                      Link to existing prospect
                    </Button>
                  </div>

                  {linkingProspect && (
                    <div className="mt-4 border-t border-white/5 pt-4">
                      {prospectsFailed ? (
                        <p className="rounded-control border border-status-declined-surface/20 bg-status-declined-surface/10 p-3 text-sm text-status-declined">
                          The list of prospects could not be loaded. This is
                          not the same as there being none.
                        </p>
                      ) : (
                        <>
                          <label
                            className="block text-sm text-zinc-300"
                            htmlFor="prospectsearch"
                          >
                            Search prospects with no account yet
                          </label>
                          <input
                            id="prospectsearch"
                            className={`${field} mt-1.5`}
                            placeholder="Name, channel or handle"
                            autoCapitalize="none"
                            autoCorrect="off"
                            value={prospectQuery}
                            onChange={(e) => {
                              setProspectQuery(e.target.value);
                              setChosenProspect(null);
                            }}
                          />

                          <ul className="mt-2 space-y-1">
                            {prospects === null ? (
                              <li className="text-sm text-text-muted">
                                Loading...
                              </li>
                            ) : prospectMatches.length === 0 ? (
                              <li className="text-sm text-text-muted">
                                No unlinked prospects match.
                              </li>
                            ) : (
                              prospectMatches.map((c) => {
                                const isChosen = chosenProspect?.id === c.id;
                                /* What linking will carry across, said
                                   before you commit rather than after. */
                                const carries = [
                                  c.note_count === 1
                                    ? "1 note"
                                    : c.note_count > 1
                                      ? `${c.note_count} notes`
                                      : null,
                                  c.open_task_count === 1
                                    ? "1 open task"
                                    : c.open_task_count > 1
                                      ? `${c.open_task_count} open tasks`
                                      : null,
                                ].filter(Boolean);
                                const reach = [c.contact_channel, c.contact_handle]
                                  .filter(Boolean)
                                  .join(" ");
                                return (
                                  <li key={c.id}>
                                    <button
                                      type="button"
                                      onClick={() => setChosenProspect(c)}
                                      aria-pressed={isChosen}
                                      className={`flex min-h-[44px] w-full items-start justify-between gap-3 rounded-control border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                                        isChosen
                                          ? "border-accent/40 bg-accent/10"
                                          : "border-white/5 bg-white/[0.02] hover:border-white/15"
                                      }`}
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-white">
                                          {c.display_name}
                                        </span>
                                        <span className="mt-0.5 block font-mono text-xs text-text-muted">
                                          {OUTREACH_LABELS[
                                            c.outreach_status as OutreachStatus
                                          ] ?? c.outreach_status}
                                          {reach && ` · ${reach}`}
                                        </span>
                                        <span className="block font-mono text-xs text-text-muted">
                                          {c.last_contact_at
                                            ? `last contact ${relativeDays(c.last_contact_at).toLowerCase()}`
                                            : "never contacted"}
                                          {carries.length > 0 &&
                                            ` · ${carries.join(", ")}`}
                                        </span>
                                      </span>
                                      {isChosen && (
                                        <Check
                                          size={15}
                                          className="mt-0.5 shrink-0 text-accent"
                                        />
                                      )}
                                    </button>
                                  </li>
                                );
                              })
                            )}
                          </ul>

                          {/* Naming both sides, because this is the one
                              action in the CRM that says two records are
                              the same person. */}
                          {chosenProspect && (
                            <div className="mt-3 rounded-control border border-accent/30 bg-accent/[0.07] p-3">
                              <p className="text-sm text-zinc-200">
                                Link{" "}
                                <strong className="text-white">
                                  {chosenProspect.display_name}
                                </strong>{" "}
                                to{" "}
                                <strong className="text-white">
                                  {identity.primary}
                                </strong>
                                ?
                              </p>
                              <p className="mt-1.5 text-xs text-text-muted">
                                Their notes, tasks, blocker and relationship
                                details are kept. Nothing is merged and
                                nothing is overwritten; only the account is
                                attached.
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  variant="accent"
                                  size="sm"
                                  className="min-h-[44px]"
                                  onClick={linkToProspect}
                                  disabled={saving}
                                >
                                  {saving ? "Linking..." : "Link them"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-[44px]"
                                  onClick={() => setChosenProspect(null)}
                                  disabled={saving}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          )}

          {/* Linking stays available for an unlinked prospect */}
          {contact && !dj && (
            <MoreDetails title="Link to an account">
              {!linking ? (
                <>
                  <p className="text-sm text-text-muted">
                    Once they sign up, link this contact to their DJ profile so
                    their real progress appears here.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 min-h-[44px]"
                    onClick={() => setLinking(true)}
                  >
                    <Link2 size={15} className="mr-1.5" />
                    Link to a DJ account
                  </Button>
                </>
              ) : candidatesFailed ? (
                <p className="rounded-control border border-status-declined-surface/20 bg-status-declined-surface/10 p-3 text-sm text-status-declined">
                  The list of accounts could not be loaded. This is not the
                  same as there being none.
                </p>
              ) : (
                <>
                  <label className="block text-sm text-zinc-300" htmlFor="linksearch">
                    Search accounts nobody has claimed
                  </label>
                  <input
                    id="linksearch"
                    className={`${field} mt-1.5`}
                    placeholder="Name or /slug"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={linkQuery}
                    onChange={(e) => {
                      setLinkQuery(e.target.value);
                      setChosen(null);
                    }}
                  />
                  <ul className="mt-2 space-y-1">
                    {candidates === null ? (
                      <li className="text-sm text-text-muted">Loading...</li>
                    ) : matches.length === 0 ? (
                      <li className="text-sm text-text-muted">
                        No unlinked accounts match.
                      </li>
                    ) : (
                      matches.map((c) => {
                        const cid = displayIdentity(c.dj_name, c.slug);
                        const isChosen = chosen?.id === c.id;
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => setChosen(c)}
                              aria-pressed={isChosen}
                              className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-control border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                                isChosen
                                  ? "border-accent/40 bg-accent/10"
                                  : "border-white/5 bg-white/[0.02] hover:border-white/15"
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-white">
                                  {cid.primary}
                                </span>
                                <span className="block font-mono text-xs text-text-muted">
                                  joined {joinedLabel(c.created_at)}
                                </span>
                              </span>
                              {isChosen && (
                                <Check size={15} className="shrink-0 text-accent" />
                              )}
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>

                  {chosen && (
                    <div className="mt-3 rounded-control border border-accent/30 bg-accent/[0.07] p-3">
                      <p className="text-sm text-zinc-200">
                        Link{" "}
                        <strong className="text-white">{contact.display_name}</strong>{" "}
                        to{" "}
                        <strong className="text-white">
                          {displayIdentity(chosen.dj_name, chosen.slug).primary}
                        </strong>
                        ?
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        This cannot be claimed by another contact afterwards.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="accent"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={linkToDj}
                          disabled={saving}
                        >
                          Link them
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={() => setChosen(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </MoreDetails>
          )}
        </div>

        {/*
          The sticky action is the form save, and only the form save. Log
          interaction was here as a duplicate of the quick action a few
          hundred pixels above it, which made the panel look as though
          logging was the only thing it could commit - while the edits
          made in Relationship details had no visible way to be saved at
          all except by opening a collapsed section and scrolling to the
          bottom of it.

          What this writes is exactly the six fields the form shows. It
          does not touch tasks, last_contact_at, notes, the Playing Next
          lifecycle, or the legacy next_action / next_follow_up_at
          columns - each of those has its own authoritative path, and a
          form that does not show a field must never write it.
        */}
        {contact && mode === "detail" && (
          <footer
            className="border-t border-white/5 bg-surface-base/95 p-4 backdrop-blur"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
          >
            <Button
              variant="accent"
              className="min-h-[48px] w-full"
              onClick={save}
              disabled={saving || !dirty}
            >
              <Check size={16} className="mr-2" />
              {saving ? "Saving..." : dirty ? "Save changes" : "No changes"}
            </Button>
          </footer>
        )}
      </div>
    </div>
  );
}
