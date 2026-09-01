"use client";

import { ShieldCheck, AlertTriangle } from "lucide-react";
import Button from "@/src/components/ui/Button";
import type { RetentionReport } from "@/src/lib/useRetentionReport";
import {
  CLASS_LABELS,
  RULE_LABELS,
  RULE_DESCRIPTIONS,
  MESSAGE_RETENTION_DAYS,
  NEVER_CHARGED_DELETION_DAYS,
  type PaymentClass,
  type RuleId,
  type RetentionPlan,
} from "@/src/lib/retention";

/*
 * ── What the retention rules would do, and nothing else ───────────
 *
 * Report only. There is no button here that executes anything, because
 * there is nothing to execute yet: the destructive executor has not been
 * written, and the kill switch that will guard it defaults to off.
 *
 * The panel states both facts on screen rather than leaving them to be
 * assumed. A compliance tool whose armed-or-not state you have to infer
 * is worse than no tool.
 *
 * It renders row IDs, classifications and field names. It never renders
 * a message, a report reason, or any other personal data: this is the
 * screen that proposes erasing that text, and showing it here would put
 * the data on one more surface for no reason.
 */
const RULES: RuleId[] = ["R1", "R2", "R3", "R4"];

const CLASS_TONE: Record<PaymentClass, string> = {
  preserve: "text-status-playing",
  never_charged: "text-accent",
  unknown: "text-status-pending",
};

export default function RetentionPanel({
  report,
}: {
  /* Fetched by the parent so the collapsed header and the body agree. */
  report: RetentionReport;
}) {
  const { data, failed, loading, reload: load } = report;
  const plan = data?.plan;
  const soonest = plan?.notYetDue
    .filter((n) => n.daysUntilDue >= 0)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const dueWithinWeek = soonest?.filter((n) => n.daysUntilDue <= 7).length ?? 0;

  return (
    <>
      <div className="border-b border-white/5 p-5">
        <p className="text-sm text-text-muted">
          What the retention rules would do. Nothing here runs anything.
        </p>

        {/* The armed state, stated rather than implied. */}
        <div className="mt-3.5 flex items-start gap-2.5 rounded-control border border-status-playing-surface/25 bg-status-playing-surface/[0.07] p-3">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-status-playing" />
          <p className="text-sm text-zinc-200">
            <strong className="text-white">Execution disabled.</strong>{" "}
            {data && !data.executorExists
              ? "No executor has been built yet, and the kill switch is off. Nothing can be cleared or deleted."
              : "The kill switch is off."}{" "}
            Arming waits on database backups and an explicit decision.
          </p>
        </div>
      </div>

      {failed ? (
        <div className="p-5">
          <p className="rounded-control border border-status-declined-surface/20 bg-status-declined-surface/10 p-3 text-sm text-status-declined">
            The retention report could not be loaded. This is not the same
            as there being nothing to do.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 min-h-[44px]"
            onClick={load}
            disabled={loading}
          >
            Try again
          </Button>
        </div>
      ) : !plan ? (
        <p className="p-8 text-center text-sm text-text-muted">
          Loading the report...
        </p>
      ) : (
        <>
          <div className="border-b border-white/5 p-5">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-text-muted">
              Would act on, today
            </p>
            <ul className="mt-3 space-y-2.5">
              {RULES.map((r) => (
                <li key={r} className="flex items-baseline gap-3">
                  <span className="w-6 shrink-0 font-mono text-xs font-bold text-text-muted">
                    {r}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-zinc-200">
                      {RULE_LABELS[r]}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">
                      {RULE_DESCRIPTIONS[r]}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-mono text-sm font-bold ${
                      plan.counts[r] > 0 ? "text-status-pending" : "text-text-muted"
                    }`}
                  >
                    {plan.counts[r]}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-b border-white/5 p-5">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-text-muted">
              Payment classification
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {(
                ["preserve", "never_charged", "unknown"] as PaymentClass[]
              ).map((c) => (
                <div key={c} className="flex items-baseline gap-2">
                  <dd
                    className={`font-mono text-lg font-bold ${CLASS_TONE[c]}`}
                  >
                    {plan.classCounts[c]}
                  </dd>
                  <dt className="text-sm text-text-muted">{CLASS_LABELS[c]}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 text-xs leading-relaxed text-text-muted">
              Unverified rows are never deleted by any rule. Only a row
              whose never-charged state is positively established can be
              removed, and only after {NEVER_CHARGED_DELETION_DAYS} days.
            </p>
          </div>

          <div className="p-5">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-text-muted">
              Coming up
            </p>
            {soonest && soonest.length > 0 ? (
              <>
                <p className="mt-2.5 text-sm text-zinc-200">
                  <strong className="text-white">
                    {plan.notYetDue.length}
                  </strong>{" "}
                  {plan.notYetDue.length === 1 ? "row holds" : "rows hold"}{" "}
                  free text that is not yet {MESSAGE_RETENTION_DAYS} days
                  old. The soonest becomes due in{" "}
                  <strong className="text-white">
                    {soonest[0].daysUntilDue}{" "}
                    {soonest[0].daysUntilDue === 1 ? "day" : "days"}
                  </strong>
                  .
                </p>
                {dueWithinWeek > 0 && (
                  <p className="mt-2 flex items-start gap-2 text-sm text-status-pending">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>
                      {dueWithinWeek} become due within seven days. Worth
                      watching this report before anything is armed.
                    </span>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2.5 text-sm text-text-muted">
                No row is holding free text that has not already been
                accounted for.
              </p>
            )}

            <p className="mt-4 font-mono text-xs text-text-muted">
              scanned {data.scanned.requests} requests · {data.scanned.tips}{" "}
              tips · {data.scanned.reports} reports ·{" "}
              {new Date(plan.generatedAt).toLocaleString()}
            </p>
          </div>
        </>
      )}
    </>
  );
}
