"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminFetch, adminJson } from "@/src/lib/adminFetch";
import {
  REQUEST_REFERENCE_PATTERN,
  VERIFICATION_LABELS,
  VERIFICATION_METHODS,
  type VerificationMethod,
} from "@/src/lib/erasure";

/*
 * ── Answering an access request ───────────────────────────────────
 *
 * Sits beside the erasure workflow and shares its shape: locate, verify,
 * then act, kept visibly separate because collapsing them is how someone
 * discloses a stranger's message.
 *
 * This panel never renders a guest message. The lookup returns field
 * names and presence only, and the export itself arrives as two files
 * the admin downloads and sends. The contents pass through the browser
 * on their way to disk; they are never drawn into the CRM.
 *
 * The records to include are ticked by hand. There is no "select all
 * for this person", because no identifier links a guest's records and
 * anything wider than what was verified would be a guess about whose
 * data this is.
 */

export type AccessCandidate = {
  objectType: string;
  objectId: string;
  label: string;
  context: string;
  createdAt: string;
};

export default function AccessRequestPanel({
  candidates,
}: {
  candidates: AccessCandidate[] | null;
}) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [proof, setProof] = useState<VerificationMethod | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  /* Suggest the next number. It does not allocate one: the admin
     confirms what they actually used on the request. */
  useEffect(() => {
    (async () => {
      try {
        const response = await adminFetch("/api/admin/privacy/reference");
        const data = await adminJson<{ suggestion: string }>(response);
        setSuggestion(data.suggestion);
        setReference((current) => current || data.suggestion);
      } catch {
        /* A missing suggestion is not worth an error. Type it by hand. */
      }
    })();
  }, []);

  const refOk = reference.length === 0 || REQUEST_REFERENCE_PATTERN.test(reference);
  const receivedOk = receivedAt.length > 0;
  const canAct = refOk && receivedOk && !busy;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setDone(null);
    try {
      const response = await adminFetch("/api/admin/privacy/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestReference: reference || null,
          receivedAt: new Date(receivedAt).toISOString(),
          ...payload,
        }),
      });
      return await adminJson<{
        recorded?: string;
        json?: unknown;
        pdfBase64?: string;
        totals?: Record<string, number>;
      }>(response);
    } finally {
      setBusy(false);
    }
  };

  const refuse = async () => {
    try {
      await post({ outcome: "verification_refused", verificationMethod: proof });
      setDone("Refusal recorded. Nothing was disclosed.");
      toast.success("Refusal recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the refusal.");
    }
  };

  const generate = async () => {
    if (!proof) return;
    try {
      const data = await post({
        verificationMethod: proof,
        objects: [...selected].map((key) => {
          const [objectType, objectId] = key.split(":");
          return { type: objectType, id: objectId };
        }),
      });

      /* Straight to disk. The files are not rendered anywhere. */
      if (data.pdfBase64) {
        download(
          `data:application/pdf;base64,${data.pdfBase64}`,
          `${reference || "playing-next"}-export.pdf`
        );
      }
      if (data.json) {
        download(
          `data:application/json;base64,${btoa(
            unescape(encodeURIComponent(JSON.stringify(data.json, null, 2)))
          )}`,
          `${reference || "playing-next"}-export.json`
        );
      }

      const t = data.totals ?? {};
      setDone(
        `Export generated and recorded: ${t.song_requests ?? 0} requests, ` +
          `${t.tips ?? 0} tips, ${t.not_played_reports ?? 0} reports. Send both files on the thread.`
      );
      toast.success("Export generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed. Nothing was released.");
    }
  };

  return (
    <div className="mt-6 rounded-card border border-white/10 bg-white/[0.02] p-4">
      {/*
        Labelled in the same mono step voice as "1 · Locate the record"
        and "3 · What would happen", but with a word rather than a
        number: this is not step four of the erasure sequence, it is a
        different outcome from the same lookup. An unlabelled heading in
        the middle of a numbered flow read as a step someone forgot to
        number. Audited 2026-09-04.
      */}
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-text-muted">
        Or · answer an access request
      </p>
      <h3 className="mt-2 text-sm font-semibold">Access request</h3>
      <p className="mt-1 text-xs text-text-muted">
        Tick only the records whose ownership you verified. The export covers those and
        nothing else.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-text-muted">Reference</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value.trim())}
            placeholder={suggestion ?? "PR-2026-001"}
            className="mt-1 w-full rounded-control border border-white/10 bg-black/30 px-3 py-2 text-sm"
          />
          {suggestion && (
            <span className="mt-1 block text-[11px] text-text-muted">
              Next available: {suggestion}
            </span>
          )}
          {!refOk && (
            <span className="mt-1 block text-[11px] text-status-declined">
              Must look like PR-2026-001.
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-text-muted">Request received</span>
          <input
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            className="mt-1 w-full rounded-control border border-white/10 bg-black/30 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-text-muted">
            When it arrived, not now. This is the one-month clock.
          </span>
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs text-text-muted">How ownership was verified</legend>
        <div className="mt-2 flex flex-col gap-2">
          {VERIFICATION_METHODS.map((method) => (
            <label key={method} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="access-proof"
                checked={proof === method}
                onChange={() => setProof(method)}
                className="mt-1"
              />
              <span>{VERIFICATION_LABELS[method]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {candidates && candidates.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-text-muted">Records to include</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {candidates.map((c) => {
              const key = `${c.objectType}:${c.objectId}`;
              return (
                <li key={key}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggle(key)}
                      className="mt-1"
                    />
                    <span>
                      {c.label}
                      <span className="block text-xs text-text-muted">{c.context}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {candidates && candidates.length === 0 && (
        <p className="mt-4 text-xs text-text-muted">
          Nothing found. An export saying so is still a complete answer.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={!canAct || !proof}
          className="rounded-control bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? "Working..." : "Generate export"}
        </button>

        <button
          type="button"
          onClick={refuse}
          disabled={!canAct}
          className="rounded-control border border-white/15 px-4 py-2 text-sm text-zinc-300 disabled:opacity-40"
        >
          Record a refused verification
        </button>
      </div>

      {done && <p className="mt-3 text-xs text-accent">{done}</p>}
    </div>
  );
}

/* A data: URL and a synthetic click. Nothing is uploaded, and nothing is
   kept: the files exist in the tab only long enough to reach disk. */
function download(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
