"use client";

import { useState } from "react";
import { Search, ShieldCheck, AlertTriangle, Lock } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { adminFetch, adminJson } from "@/src/lib/adminFetch";
import AccessRequestPanel from "@/src/components/admin/AccessRequestPanel";
import { CLASS_LABELS, type PaymentClass } from "@/src/lib/retention";
import {
  VERIFICATION_METHODS,
  VERIFICATION_LABELS,
  REQUEST_REFERENCE_PATTERN,
  type VerificationMethod,
} from "@/src/lib/erasure";
import type { PipelineRow } from "@/src/components/admin/crmTypes";

/*
 * ── Handling a privacy request ────────────────────────────────────
 *
 * Locate, verify, then erase - three steps kept visibly separate,
 * because collapsing them is how someone erases a stranger's message.
 * Confirm stays disabled until a form of proof has been recorded, and
 * "I found the row" is not one of the options.
 *
 * The panel never renders a message, a reason or an address. It shows
 * which personal fields are present and what will be retained. An admin
 * does not need to read someone's words in order to delete them, and the
 * screen proposing the deletion is the last place they should appear.
 */
type Candidate = {
  objectType: string;
  objectId: string;
  label: string;
  context: string;
  createdAt: string;
  classification: PaymentClass;
  presentFields: string[];
  eligible: boolean;
  fields: string[];
  retained: string;
  reason: string;
};

const CLASS_TONE: Record<PaymentClass, string> = {
  preserve: "text-status-playing",
  never_charged: "text-accent",
  unknown: "text-status-pending",
};

export default function PrivacyPanel({ rows }: { rows: PipelineRow[] }) {
  const [mode, setMode] = useState<"reference" | "attributes">("reference");
  const [reference, setReference] = useState("");
  const [dj, setDj] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [song, setSong] = useState("");

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [proof, setProof] = useState<VerificationMethod | null>(null);
  const [prRef, setPrRef] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const djOptions = rows.filter((r) => r.dj);

  const search = async () => {
    setSearching(true);
    setFailed(null);
    setChosen(null);
    setResult(null);
    try {
      const params = new URLSearchParams();
      if (mode === "reference") params.set("reference", reference.trim());
      else {
        if (dj) params.set("dj", dj);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (song) params.set("song", song.trim());
      }
      const response = await adminFetch(`/api/admin/privacy/lookup?${params}`);
      const data = await adminJson<{ candidates: Candidate[] }>(response);
      setCandidates(data.candidates);
    } catch (error) {
      /* A failed search must never read as "we hold nothing". */
      setFailed(error instanceof Error ? error.message : "Lookup failed.");
      setCandidates(null);
    } finally {
      setSearching(false);
    }
  };

  const refOk = prRef.length === 0 || REQUEST_REFERENCE_PATTERN.test(prRef);
  const canErase = !!chosen?.eligible && !!proof && refOk;

  const erase = async () => {
    if (!chosen || !proof) return;
    try {
      const response = await adminFetch("/api/admin/privacy/erase", {
        method: "POST",
        body: JSON.stringify({
          objectType: chosen.objectType,
          objectId: chosen.objectId,
          verificationMethod: proof,
          requestReference: prRef || null,
        }),
      });
      const data = await adminJson<{ erased: string[]; retained: string }>(response);
      setResult(
        `Erased ${data.erased.join(", ")}. Retained: ${data.retained.toLowerCase()}.`
      );
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Erasure failed.");
    }
  };

  const field =
    "h-12 w-full rounded-control border border-white/10 bg-black/30 px-3 text-base text-white outline-none placeholder:text-zinc-600 focus:border-accent/40 md:h-11 md:text-sm";

  return (
    <>
      <div className="border-b border-white/5 p-5">
        <p className="text-sm text-text-muted">
          Find what Playing Next holds about someone, and erase the
          personal parts of it.
        </p>
        <div className="mt-3.5 flex items-start gap-2.5 rounded-control border border-status-playing-surface/25 bg-status-playing-surface/[0.07] p-3">
          <Lock size={16} className="mt-0.5 shrink-0 text-status-playing" />
          <p className="text-sm text-zinc-200">
            <strong className="text-white">Erasure is disabled.</strong> Lookup
            works and writes nothing. The erase action returns 503 until it
            is deliberately enabled.
          </p>
        </div>
      </div>

      {/* ── 1 · Locate ───────────────────────────────────────── */}
      <div className="border-b border-white/5 p-5">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-text-muted">
          1 · Locate the record
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["reference", "attributes"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`min-h-[44px] rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                mode === m
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-white/10 bg-white/5 text-text-muted hover:text-white"
              }`}
            >
              {m === "reference" ? "Stripe reference" : "DJ, date and song"}
            </button>
          ))}
        </div>

        {mode === "reference" ? (
          <div className="mt-3">
            <label className="text-sm text-zinc-300" htmlFor="pi">
              PaymentIntent or Checkout Session
            </label>
            <input
              id="pi"
              className={`${field} mt-1.5`}
              placeholder="pi_3Q... or cs_test_..."
              autoCapitalize="none"
              autoCorrect="off"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-text-muted">
              Search Stripe by the email they contacted you from, then paste
              the reference here. Their email is used in Stripe and never
              stored by Playing Next.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-sm text-zinc-300" htmlFor="dj">DJ</label>
              <select
                id="dj"
                className={`${field} mt-1.5`}
                value={dj}
                onChange={(e) => setDj(e.target.value)}
              >
                <option value="" className="bg-zinc-900">Any DJ</option>
                {djOptions.map((r) => (
                  <option key={r.dj!.id} value={r.dj!.id} className="bg-zinc-900">
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-0 flex-1">
                <label className="text-sm text-zinc-300" htmlFor="from">From</label>
                <input id="from" type="date" className={`${field} mt-1.5`} value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="min-w-0 flex-1">
                <label className="text-sm text-zinc-300" htmlFor="to">To</label>
                <input id="to" type="date" className={`${field} mt-1.5`} value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-300" htmlFor="song">Song</label>
              <input id="song" className={`${field} mt-1.5`} placeholder="Part of the title" value={song} onChange={(e) => setSong(e.target.value)} />
            </div>
            <p className="text-xs leading-relaxed text-status-pending">
              A match here locates a record. It never proves the person
              asking is the person who wrote it: anyone at that gig knows
              the DJ, the date and the song.
            </p>
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          className="mt-3.5 min-h-[44px]"
          onClick={search}
          disabled={searching}
        >
          <Search size={15} className="mr-1.5" />
          {searching ? "Searching..." : "Find records"}
        </Button>
      </div>

      {/* ── 2 · Candidates ───────────────────────────────────── */}
      {failed && (
        <p className="m-5 rounded-control border border-status-declined-surface/20 bg-status-declined-surface/10 p-3 text-sm text-status-declined">
          {failed} This is not the same as finding nothing.
        </p>
      )}

      {candidates && (
        <div className="border-b border-white/5 p-5">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-text-muted">
            2 · {candidates.length} record{candidates.length === 1 ? "" : "s"} found
          </p>
          {candidates.length === 0 ? (
            <p className="mt-2.5 text-sm text-text-muted">
              Nothing matched. Try the other lookup, or a wider date range.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {candidates.map((c) => (
                <li key={c.objectId}>
                  <button
                    type="button"
                    onClick={() => { setChosen(c); setResult(null); }}
                    aria-pressed={chosen?.objectId === c.objectId}
                    className={`w-full rounded-control border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                      chosen?.objectId === c.objectId
                        ? "border-accent/40 bg-accent/10"
                        : "border-white/5 bg-white/[0.02] hover:border-white/15"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-white">
                      {c.label} · {c.context}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-text-muted">
                      {new Date(c.createdAt).toLocaleDateString()} ·{" "}
                      <span className={CLASS_TONE[c.classification]}>
                        {CLASS_LABELS[c.classification]}
                      </span>
                      {" · "}
                      {c.presentFields.length > 0
                        ? `${c.presentFields.length} personal field${c.presentFields.length === 1 ? "" : "s"}`
                        : "no personal data"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── 3 · Verify and erase ─────────────────────────────── */}
      {chosen && (
        <div className="p-5">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-text-muted">
            3 · What would happen
          </p>

          <div className="mt-3 space-y-2.5 rounded-control border border-white/5 bg-white/[0.02] p-3.5">
            {chosen.eligible ? (
              <p className="text-sm text-status-declined">
                <strong className="text-white">Erased:</strong>{" "}
                {chosen.fields.join(", ")}
              </p>
            ) : (
              <p className="flex items-start gap-2 text-sm text-status-pending">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {chosen.reason}
              </p>
            )}
            <p className="text-sm text-status-playing">
              <strong className="text-white">Retained:</strong>{" "}
              {chosen.retained.toLowerCase()}
            </p>
            {chosen.eligible && (
              <p className="text-xs leading-relaxed text-text-muted">
                {chosen.reason} The record itself is not deleted.
              </p>
            )}
          </div>

          {chosen.eligible && (
            <>
              <p className="mt-4 text-sm font-semibold text-zinc-200">
                How was ownership verified?
              </p>
              <ul className="mt-2 space-y-2">
                {VERIFICATION_METHODS.map((m) => (
                  <li key={m}>
                    <button
                      type="button"
                      onClick={() => setProof(m)}
                      aria-pressed={proof === m}
                      className={`min-h-[44px] w-full rounded-control border p-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        proof === m
                          ? "border-accent/40 bg-accent/10 text-white"
                          : "border-white/5 bg-white/[0.02] text-zinc-300 hover:border-white/15"
                      }`}
                    >
                      {VERIFICATION_LABELS[m]}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-3.5">
                <label className="text-sm text-zinc-300" htmlFor="prref">
                  Privacy-request reference (optional)
                </label>
                <input
                  id="prref"
                  className={`${field} mt-1.5`}
                  placeholder="PR-2026-001"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  value={prRef}
                  onChange={(e) => setPrRef(e.target.value.toUpperCase())}
                />
                {!refOk && (
                  <p className="mt-1.5 text-xs text-status-declined">
                    Must look like PR-2026-001. No names, emails or notes.
                  </p>
                )}
              </div>

              <Button
                variant="accent"
                className="mt-4 min-h-[48px] w-full"
                onClick={erase}
                disabled={!canErase}
              >
                <ShieldCheck size={16} className="mr-2" />
                {chosen.fields.length === 1
                  ? `Erase the ${chosen.fields[0].replace(/_/g, " ")}`
                  : `Erase ${chosen.fields.length} personal fields`}
              </Button>
              {!proof && (
                <p className="mt-2 text-xs text-text-muted">
                  Record how ownership was verified to continue.
                </p>
              )}
            </>
          )}

          {result && (
            <p className="mt-3 rounded-control border border-white/10 bg-black/30 p-3 text-sm text-zinc-200">
              {result}
            </p>
          )}
        </div>
      )}

      {/* Access requests share the lookup above: the same candidates,
          the same verification vocabulary, a different outcome. */}
      <AccessRequestPanel candidates={candidates} />
    </>
  );
}
