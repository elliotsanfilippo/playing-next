"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  X,
  Trash2,
  Link2,
  Check,
  Clock,
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
import { displayIdentity, joinedLabel, relativeDays } from "@/src/lib/djIdentity";
import { isInternalDj } from "@/src/lib/internalAccounts";
import {
  ACQUISITION_SOURCES,
  ACTIVATION_BLOCKERS,
  BLOCKER_LABELS,
  OUTREACH_LABELS,
  OUTREACH_STATUSES,
  type ActivationBlocker,
} from "@/src/lib/crmTaxonomy";
import { stageTone } from "@/src/components/admin/stageTone";
import ContactIdentity from "@/src/components/admin/ContactIdentity";
import LogInteractionForm, {
  type LogPayload,
} from "@/src/components/admin/LogInteractionForm";
import { MoreDetails, SectionLabel } from "@/src/components/admin/DrawerSections";
import {
  hasNextStep,
  donePatch,
  laterPatch,
  dueLabel,
  LATER_OPTIONS,
} from "@/src/lib/crmActions";
import type {
  CrmContact,
  CrmNote,
  PipelineRow,
  UnlinkedDj,
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
}: {
  row: PipelineRow;
  onClose: () => void;
  onChanged: () => void;
  /* Lets the parent move the open drawer onto the merged row rather
     than letting it unmount when the prospect's key disappears. */
  onLinked?: (contactId: string, djProfileId: string) => Promise<void>;
  /** Overview's Log button opens the drawer straight into the log flow. */
  initialMode?: "detail" | "log";
}) {
  const { containerRef, dialogProps } = useModalA11y({ open: true, onClose });
  const viewport = useVisualViewport();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useKeepFocusVisible(scrollerRef, viewport.keyboardOpen);

  const contact = row.contact;
  const dj = row.dj;
  const identity = displayIdentity(dj?.dj_name ?? row.name, dj?.slug);

  const [draft, setDraft] = useState({
    outreach_status: contact?.outreach_status ?? "prospect",
    activation_blocker: contact?.activation_blocker ?? "",
    acquisition_source: contact?.acquisition_source ?? "",
    contact_channel: contact?.contact_channel ?? "",
    contact_handle: contact?.contact_handle ?? "",
    next_gig_date: dateInput(contact?.next_gig_date ?? null),
    next_follow_up_at: dateInput(contact?.next_follow_up_at ?? null),
    next_action: contact?.next_action ?? "",
  });

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

  const save = () =>
    patch(
      {
        outreach_status: draft.outreach_status,
        activation_blocker: draft.activation_blocker || null,
        acquisition_source: draft.acquisition_source || null,
        contact_channel: draft.contact_channel || null,
        contact_handle: draft.contact_handle || null,
        next_gig_date: draft.next_gig_date || null,
        next_follow_up_at: draft.next_follow_up_at || null,
        next_action: draft.next_action || null,
      },
      "Saved."
    );

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
  const completeStep = () => patch(donePatch(), "Next step cleared.");

  const later = (days: number, label: string) =>
    patch(laterPatch(days), `Moved to ${label.toLowerCase()}.`);

  /* The one action that writes history, and the only one that advances
     last_contact_at, because an interaction genuinely is contact. */
  const logInteraction = async (payload: LogPayload) => {
    if (!contact) return;
    setSaving(true);
    try {
      await adminJson(
        await adminFetch("/api/admin/crm/notes", {
          method: "POST",
          body: JSON.stringify({ contact_id: contact.id, body: payload.note }),
        })
      );

      const fields: Record<string, unknown> = {
        last_contact_at: new Date().toISOString(),
        next_action: payload.nextAction.trim() || null,
        next_follow_up_at: payload.nextAction.trim()
          ? payload.nextDate || null
          : null,
      };
      if (payload.blockerChanged) fields.activation_blocker = payload.blocker;

      await adminJson(
        await adminFetch("/api/admin/crm/contacts", {
          method: "PATCH",
          body: JSON.stringify({ id: contact.id, ...fields }),
        })
      );

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
        body: JSON.stringify({
          display_name: dj.dj_name,
          dj_profile_id: dj.id,
          outreach_status: "signed_up",
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

  const linkToDj = async () => {
    if (!contact || !chosen) return;
    setSaving(true);
    try {
      const response = await adminFetch("/api/admin/crm/contacts", {
        method: "PATCH",
        body: JSON.stringify({ id: contact.id, dj_profile_id: chosen.id }),
      });
      await adminJson<{ contact: CrmContact }>(response);
      toast.success(`Linked to ${chosen.dj_name}.`);
      setLinking(false);
      setChosen(null);

      if (onLinked) {
        await onLinked(contact.id, chosen.id);
        /*
         * The "Link them" button this click came from has just been
         * removed from the DOM along with the whole linking panel, so
         * without moving focus deliberately it would fall back to
         * <body> and the next Tab would start from the top of the
         * dialog. The container carries tabIndex={-1} for exactly this.
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

  const addNote = async () => {
    if (!contact || !newNote.trim()) return;
    try {
      const response = await adminFetch("/api/admin/crm/notes", {
        method: "POST",
        body: JSON.stringify({ contact_id: contact.id, body: newNote }),
      });
      const result = await adminJson<{ note: CrmNote }>(response);
      setNotes((current) => [result.note, ...current]);
      setNewNote("");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save.");
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

  const blockerLabel = contact?.activation_blocker
    ? BLOCKER_LABELS[contact.activation_blocker as ActivationBlocker]
    : null;
  const step = contact?.next_action?.trim() || null;
  const due = dueLabel(contact?.next_follow_up_at);

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
                <SectionLabel>What happens next</SectionLabel>

                {step ? (
                  <>
                    <p className="mt-2.5 text-base text-white">{step}</p>
                    {due && (
                      <p
                        className={`mt-1.5 font-mono text-xs ${
                          due.overdue
                            ? "text-status-declined"
                            : due.today
                              ? "text-status-pending"
                              : "text-text-muted"
                        }`}
                      >
                        {due.text}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={completeStep}
                        disabled={saving}
                      >
                        <Check size={14} className="mr-1.5" />
                        Done
                      </Button>

                      {/* Later is a menu, not four permanent buttons */}
                      <details className="relative [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex min-h-[44px] cursor-pointer list-none items-center rounded-control border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                          <Clock size={14} className="mr-1.5" />
                          Later
                        </summary>
                        <div className="absolute left-0 z-10 mt-1 w-44 overflow-hidden rounded-control border border-white/10 bg-surface-overlay shadow-xl shadow-black/50">
                          {LATER_OPTIONS.map((o) => (
                            <button
                              key={o.days}
                              type="button"
                              onClick={() => later(o.days, o.label)}
                              disabled={saving}
                              className="flex min-h-[44px] w-full items-center px-4 text-left text-sm text-zinc-200 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </details>
                    </div>
                  </>
                ) : (
                  <p className="mt-2.5 text-sm text-text-muted">
                    Nothing planned. You are waiting on them, so there is no
                    task of yours to complete. Log an interaction when they
                    reply, or to record that you chased.
                  </p>
                )}
              </section>

              {/* ── History ───────────────────────────────────── */}
              <section className="border-b border-white/5 p-5">
                <SectionLabel>History</SectionLabel>

                <div className="mt-3 space-y-2">
                  {notesFailed ? (
                    <p className="rounded-control border border-status-declined-surface/20 bg-status-declined-surface/10 p-3 text-sm text-status-declined">
                      History could not be loaded. This is not the same as
                      there being none.
                    </p>
                  ) : notes.length === 0 ? (
                    <p className="text-sm text-text-muted">
                      Nothing recorded yet.
                    </p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="flex items-start justify-between gap-3 rounded-control border border-white/5 bg-white/[0.02] p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-200">{note.body}</p>
                          <p className="mt-1 font-mono text-xs text-text-muted">
                            {new Date(note.occurred_at).toLocaleDateString(
                              undefined,
                              { day: "numeric", month: "short" }
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          aria-label="Delete note"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-text-muted transition hover:text-status-declined focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
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

                  <div>
                    <label className="text-sm text-zinc-300" htmlFor="gig">
                      Next gig
                    </label>
                    <input
                      id="gig"
                      type="date"
                      className={`${field} mt-1.5`}
                      value={draft.next_gig_date}
                      onChange={(e) =>
                        setDraft({ ...draft, next_gig_date: e.target.value })
                      }
                    />
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
                      {OUTREACH_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-zinc-900">
                          {OUTREACH_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-text-muted">
                      Kept for the record. Nothing in the Admin reads it, so
                      it does not need maintaining.
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    className="min-h-[44px] w-full"
                    onClick={save}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save details"}
                  </Button>
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
                <section className="rounded-card border border-white/5 bg-white/[0.02] p-5">
                  <p className="text-sm text-zinc-300">
                    This DJ has no CRM context yet.
                  </p>
                  <p className="mt-1.5 text-sm text-text-muted">
                    Add it to record where they came from, what is blocking
                    them and when to follow up.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4 min-h-[44px]"
                    onClick={createContact}
                    disabled={saving}
                  >
                    <Link2 size={15} className="mr-1.5" />
                    Add CRM context
                  </Button>
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

        {/* The primary action, always reachable. Not a form save. */}
        {contact && mode === "detail" && (
          <footer
            className="border-t border-white/5 bg-surface-base/95 p-4 backdrop-blur"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
          >
            <Button
              variant="accent"
              className="min-h-[48px] w-full"
              onClick={() => setMode("log")}
              disabled={saving}
            >
              <MessageSquarePlus size={16} className="mr-2" />
              Log interaction
            </Button>
          </footer>
        )}
      </div>
    </div>
  );
}
