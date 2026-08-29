"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Trash2, Link2, Plus } from "lucide-react";
import Button from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";
import { useModalA11y } from "@/src/lib/useModalA11y";
import { adminFetch, adminJson } from "@/src/lib/adminFetch";
import { LIFECYCLE_LABELS } from "@/src/lib/djLifecycle";
import {
  ACQUISITION_SOURCES,
  ACTIVATION_BLOCKERS,
  BLOCKER_LABELS,
  OUTREACH_LABELS,
  OUTREACH_STATUSES,
} from "@/src/lib/crmTaxonomy";
import { stageTone } from "@/src/components/admin/stageTone";
import type { CrmContact, CrmNote, PipelineRow } from "@/src/components/admin/crmTypes";

const field =
  "h-11 w-full rounded-control border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/30";

const label = "text-xs font-semibold uppercase tracking-wide text-text-muted";

function dateInput(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function DjDetailDrawer({
  row,
  onClose,
  onChanged,
}: {
  row: PipelineRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { dialogProps } = useModalA11y({ open: true, onClose });

  const contact = row.contact;
  const dj = row.dj;

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
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /* All state changes live inside the async body: an effect that sets
       state synchronously on mount causes a second render before paint,
       and React's lint rule is right to refuse it. */
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
        /* A failed note load must not render as "no notes yet" - that is
           the same confident-empty-state bug fixed on the guest page and
           the dashboard. */
        if (!cancelled) setNotesFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contact]);

  /*
   * Creating CRM context for a DJ who signed up without ever being in
   * the outreach pipeline. dj_profile_id is UNIQUE, so this can only
   * ever succeed once per DJ; a second attempt comes back as a readable
   * 409 rather than a duplicate row.
   */
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

  const save = async () => {
    if (!contact) return;
    setSaving(true);
    try {
      const response = await adminFetch("/api/admin/crm/contacts", {
        method: "PATCH",
        body: JSON.stringify({
          id: contact.id,
          outreach_status: draft.outreach_status,
          activation_blocker: draft.activation_blocker || null,
          acquisition_source: draft.acquisition_source || null,
          contact_channel: draft.contact_channel || null,
          contact_handle: draft.contact_handle || null,
          next_gig_date: draft.next_gig_date || null,
          next_follow_up_at: draft.next_follow_up_at || null,
          next_action: draft.next_action || null,
        }),
      });
      await adminJson<{ contact: CrmContact }>(response);
      toast.success("Saved.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!contact || !newNote.trim()) return;
    setAddingNote(true);
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
    } finally {
      setAddingNote(false);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const response = await adminFetch(`/api/admin/crm/notes?id=${id}`, {
        method: "DELETE",
      });
      await adminJson(response);
      setNotes((current) => current.filter((n) => n.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        {...dialogProps("crm-drawer-title")}
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-white/10 bg-surface-base shadow-2xl shadow-black/60 scroll-subtle"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/5 bg-surface-base/95 p-5 backdrop-blur">
          <div className="min-w-0">
            <h2 id="crm-drawer-title" className="truncate text-h3">
              {row.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={stageTone(row.stage)}>
                {LIFECYCLE_LABELS[row.stage]}
              </Badge>
              {dj && (
                <span className="text-xs text-text-muted">/{dj.slug}</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="shrink-0 rounded-control p-2 text-text-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-8 p-5">
          <section>
            <p className={label}>Derived automatically</p>
            <p className="mt-1 text-xs text-text-muted">
              Read from the product. Not editable, and never stored in the CRM.
            </p>

            {dj ? (
              <dl className="mt-3 grid grid-cols-2 gap-3">
                {[
                  ["Onboarding", dj.onboarding_complete ? "Complete" : "Incomplete"],
                  ["Payments", dj.stripe_connected ? "Ready" : "Not ready"],
                  ["Paid requests", String(dj.paid_accepted_count)],
                  ["Gig nights", String(dj.gig_date_count)],
                  ["Net earnings", `£${dj.net_earnings.toFixed(2)}`],
                  ["Plan", dj.plan || "free"],
                ].map(([term, value]) => (
                  <div
                    key={term}
                    className="rounded-control border border-white/5 bg-white/[0.02] p-3"
                  >
                    <dt className="text-xs text-text-muted">{term}</dt>
                    <dd className="mt-1 text-sm font-semibold text-white">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 rounded-control border border-white/5 bg-white/[0.02] p-4 text-sm text-text-muted">
                No Playing Next account yet. Nothing to derive until they sign
                up and this contact is linked to their profile.
              </p>
            )}
          </section>

          {contact ? (
            <>
              <section className="space-y-4">
                <div>
                  <p className={label}>Relationship</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Yours to maintain. Nothing here is guessed or overwritten.
                  </p>
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
                </div>

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

                <div className="grid grid-cols-2 gap-3">
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
                    <label className="text-sm text-zinc-300" htmlFor="followup">
                      Follow up on
                    </label>
                    <input
                      id="followup"
                      type="date"
                      className={`${field} mt-1.5`}
                      value={draft.next_follow_up_at}
                      onChange={(e) =>
                        setDraft({ ...draft, next_follow_up_at: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-zinc-300" htmlFor="action">
                    Next action
                  </label>
                  <input
                    id="action"
                    className={`${field} mt-1.5`}
                    placeholder="Ask about the Friday residency"
                    value={draft.next_action}
                    onChange={(e) =>
                      setDraft({ ...draft, next_action: e.target.value })
                    }
                  />
                </div>

                <Button variant="accent" onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </section>

              <section>
                <p className={label}>Notes</p>

                <div className="mt-3 flex gap-2">
                  <input
                    className={field}
                    placeholder="What was said?"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addNote();
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addNote}
                    disabled={addingNote || !newNote.trim()}
                    className="shrink-0"
                  >
                    <Plus size={15} />
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {notesFailed ? (
                    <p className="rounded-control border border-status-declined-surface/20 bg-status-declined-surface/10 p-3 text-sm text-status-declined">
                      Notes could not be loaded. This is not the same as having
                      none.
                    </p>
                  ) : notes.length === 0 ? (
                    <p className="text-sm text-text-muted">No notes yet.</p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="group flex items-start justify-between gap-3 rounded-control border border-white/5 bg-white/[0.02] p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-200">{note.body}</p>
                          <p className="mt-1 text-xs text-text-muted">
                            {new Date(note.occurred_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          aria-label="Delete note"
                          className="shrink-0 rounded p-1.5 text-text-muted transition hover:text-status-declined focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-card border border-white/5 bg-white/[0.02] p-5">
              <p className="text-sm text-zinc-300">
                This DJ has no CRM context yet.
              </p>
              <p className="mt-1.5 text-sm text-text-muted">
                Add it to record where they came from, what is blocking them and
                when to follow up.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={createContact}
                disabled={saving}
              >
                <Link2 size={15} className="mr-1.5" />
                Add CRM context
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
