"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import TaskDateChoice from "@/src/components/admin/TaskDateChoice";
import {
  resolveTaskDate,
  type TaskDateOption,
} from "@/src/lib/taskDates";
import {
  ACTIVATION_BLOCKERS,
  BLOCKER_LABELS,
} from "@/src/lib/crmTaxonomy";
import type { CrmContact } from "@/src/components/admin/crmTypes";

const field =
  "w-full rounded-control border border-white/10 bg-black/30 px-3 py-3 text-base text-white outline-none placeholder:text-zinc-600 focus:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/30 md:text-sm";

export type LogPayload = {
  note: string;
  blocker: string | null;
  blockerChanged: boolean;
  nextAction: string;
  /** Already resolved to a timestamp or null by the shared helper. */
  nextDate: string | null;
};

/*
 * ── One act, one save ─────────────────────────────────────────────
 *
 * The complaint this exists to answer: after messaging a DJ you had to
 * decide which of four fields to touch, and the one button that looked
 * like the answer did nothing you could see.
 *
 * Here you answer two questions - what happened, and what next - and the
 * CRM maintains state and history from the same act. Only the note is
 * required, because an interaction that produced no decision is still
 * worth recording.
 */
export default function LogInteractionForm({
  contact,
  saving,
  onCancel,
  onSave,
}: {
  contact: CrmContact;
  saving: boolean;
  onCancel: () => void;
  onSave: (payload: LogPayload) => void;
}) {
  const [note, setNote] = useState("");
  const [blocker, setBlocker] = useState(contact.activation_blocker ?? "");
  /* Empty, always. This creates a NEW task; prefilling it from the
     legacy next_action would resurrect the field this replaced and make
     every log silently re-propose the same stale text. */
  const [nextAction, setNextAction] = useState("");
  /* Same control and same options as + Task, Edit and Reschedule. */
  const [dateOption, setDateOption] = useState<TaskDateOption>("none");
  const [picked, setPicked] = useState("");

  const blockerChanged = (blocker || null) !== (contact.activation_blocker ?? null);

  return (
    <div className="space-y-6 p-5">
      <div>
        <label
          className="text-sm font-semibold text-zinc-200"
          htmlFor="log-note"
        >
          What happened?
        </label>
        <p className="mt-1 text-xs text-text-muted">
          Goes into their history exactly as you write it, and records that
          you were in contact today.
        </p>
        <textarea
          id="log-note"
          autoFocus
          rows={4}
          className={`${field} mt-2.5 resize-y`}
          placeholder="Replied saying he has another set next Saturday"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-zinc-200" htmlFor="log-blocker">
          Did anything change?
        </label>
        <p className="mt-1 text-xs text-text-muted">
          Only if they told you something new. Leave it as it is otherwise.
        </p>
        <select
          id="log-blocker"
          className={`${field} mt-2.5 h-12`}
          value={blocker}
          onChange={(e) => setBlocker(e.target.value)}
        >
          <option value="" className="bg-zinc-900">
            Nothing blocking them
          </option>
          {ACTIVATION_BLOCKERS.map((b) => (
            <option key={b} value={b} className="bg-zinc-900">
              {BLOCKER_LABELS[b]}
            </option>
          ))}
        </select>
        {blockerChanged && (
          <p className="mt-1.5 text-xs text-accent">
            Will change from{" "}
            {contact.activation_blocker
              ? BLOCKER_LABELS[
                  contact.activation_blocker as keyof typeof BLOCKER_LABELS
                ]
              : "nothing blocking them"}
            .
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-semibold text-zinc-200" htmlFor="log-next">
          What next?
        </label>
        <p className="mt-1 text-xs text-text-muted">
          Leave empty if the ball is in their court. They stay visible while
          you are waiting on a reply.
        </p>
        <input
          id="log-next"
          className={`${field} mt-2.5 h-12`}
          placeholder="Check how the Saturday set went"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />

        {nextAction.trim() ? (
          <div className="mt-3">
            <p className="text-sm text-zinc-300">When</p>
            <div className="mt-1.5">
              <TaskDateChoice
                option={dateOption}
                picked={picked}
                onOption={setDateOption}
                onPicked={setPicked}
                idPrefix="log"
              />
            </div>
          </div>
        ) : (
          /* A dated reminder with no task is what made the old model
             meaningless, so the date cannot be set on its own. */
          <p className="mt-3 text-xs text-text-muted">
            Add a next step first. A date on its own is not something you
            can act on.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="accent"
          className="min-h-[44px] flex-1"
          disabled={saving || !note.trim()}
          onClick={() =>
            onSave({
              note,
              blocker: blocker || null,
              blockerChanged,
              nextAction,
              nextDate: resolveTaskDate(dateOption, picked),
            })
          }
        >
          {saving ? "Saving..." : "Save interaction"}
        </Button>
        <Button
          variant="ghost"
          className="min-h-[44px]"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
