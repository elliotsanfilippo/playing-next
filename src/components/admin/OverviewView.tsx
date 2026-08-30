"use client";

import { useMemo, useState } from "react";
import { Flag, Clock, ArrowRight, MessageSquarePlus } from "lucide-react";
import { BLOCKER_LABELS, type ActivationBlocker } from "@/src/lib/crmTaxonomy";
import ContactIdentity from "@/src/components/admin/ContactIdentity";
import { MoreDetails } from "@/src/components/admin/DrawerSections";
import { hasNextStep } from "@/src/lib/crmActions";
import { relativeDays } from "@/src/lib/djIdentity";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { buildExternalFunnel } from "@/src/lib/crmFunnel";
import {
  buildQueue,
  countByTier,
  QUEUE_TIERS,
  TIER_LABELS,
  type QueueTier,
} from "@/src/lib/crmQueue";
import { displayIdentity, joinedLabel } from "@/src/lib/djIdentity";
import { isInternalDj } from "@/src/lib/internalAccounts";
import type { DjStat, PipelineRow, Report } from "@/src/components/admin/crmTypes";

const MOBILE_PREVIEW = 5;

/*
 * Colour only where it means urgency.
 *
 * Every row used to carry a tinted background AND a coloured left
 * border AND a lifecycle badge AND a coloured blocker AND coloured
 * timing, so nothing stood out because everything did. Now only an
 * overdue or due-today row gets an accent edge; awaiting reply, upcoming
 * and stalled rows are plain dark cards and let the badge and the
 * blocker carry the meaning. The transparent border keeps every row on
 * the same grid so nothing shifts when one becomes urgent.
 */
const tierTone: Record<QueueTier, string> = {
  overdue: "border-status-declined",
  today: "border-status-pending",
  upcoming: "border-transparent",
  attention: "border-transparent",
  stalled: "border-transparent",
};

/* Timing is neutral unless it is actually late. */
const stampTone: Record<QueueTier, string> = {
  overdue: "text-status-declined",
  today: "text-status-pending",
  upcoming: "text-text-muted",
  attention: "text-text-muted",
  stalled: "text-text-muted",
};

export default function OverviewView({
  rows,
  djs,
  reports,
  onOpen,
  onLater,
  onGoToReports,
}: {
  rows: PipelineRow[];
  djs: DjStat[];
  reports: Report[];
  onOpen: (key: string, mode?: "detail" | "log") => void;
  onLater: (row: PipelineRow, days: number) => void;
  onGoToReports: () => void;
}) {
  const [tier, setTier] = useState<QueueTier | "all">("all");
  const [showAll, setShowAll] = useState(false);
  /* Captured once per mount rather than read during render: a clock read
     in the render body gives a different answer on every re-render, so
     "this week" could silently change while nothing else did. */
  const [mountedAt] = useState(() => Date.now());

  const funnel = useMemo(
    () =>
      buildExternalFunnel(
        djs.map((d) => ({
          id: d.id,
          slug: d.slug,
          onboarding_complete: d.onboarding_complete,
          stripe_connected: d.stripe_connected,
          paid_accepted_count: d.paid_accepted_count,
          gig_date_count: d.gig_date_count,
        }))
      ),
    [djs]
  );

  const queue = useMemo(() => buildQueue(rows), [rows]);
  const counts = useMemo(() => countByTier(queue), [queue]);
  const visible = tier === "all" ? queue : queue.filter((q) => q.tier === tier);
  /* On a phone the whole queue is a very long page, and the point of the
     screen is the top of it. Desktop keeps the full list. */
  const shown = showAll ? visible : visible.slice(0, MOBILE_PREVIEW);
  const hiddenCount = visible.length - shown.length;

  const pending = reports.filter((r) => r.resolution === "pending");

  const newThisWeek = useMemo(() => djs.filter(
    (d) =>
      !isInternalDj(d.slug) &&
      mountedAt - new Date(d.created_at).getTime() < 7 * 86_400_000
  ), [djs, mountedAt]);

  /* The activation step, pulled out so the headline can name it. */
  const readyStep = funnel.steps.find((s) => s.key === "onboarded");
  const activatedStep = funnel.steps.find((s) => s.key === "activated");
  const maxCount = Math.max(...funnel.steps.map((s) => s.count), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="order-2 grid gap-4 md:order-1 md:grid-cols-[2.2fr_1fr]">
        <Card
          variant="elevated"
          className="border-status-pending-surface/25 bg-status-pending-surface/[0.05] p-5"
        >
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-text-muted">
            The bottleneck
          </p>
          <p className="mt-2 text-h2 text-status-pending">
            {activatedStep?.count ?? 0} of {readyStep?.count ?? 0}
          </p>
          <p className="mt-1.5 text-sm text-text-muted">
            DJs who finished onboarding have taken a paid request. Every
            technical blocker is cleared. What is missing is a gig.
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-text-muted">New this week</p>
          <p className="mt-2 text-2xl font-bold">{newThisWeek.length}</p>
          <p className="mt-1 text-xs text-text-muted">
            {newThisWeek.filter((d) => !d.onboarding_complete).length} not
            onboarded
          </p>
        </Card>
      </div>

      {/*
        Compressed for mobile. The four counts read as one sentence, the
        cross-cutting payments fact sits beside them as a chip, and the
        one insight worth acting on is a single line. Bars, per-step
        definitions and drop-off move behind a disclosure - the
        explanations are good and are kept, they just are not open by
        default on a phone.
      */}
      <Card variant="elevated" className="order-3 overflow-hidden md:order-2">
        <div className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h3">Growth</h2>
            <p className="font-mono text-xs text-text-muted">
              {funnel.total} external · {funnel.internalExcluded} internal
              excluded
            </p>
          </div>

          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {funnel.steps.map((step) => (
              <div key={step.key} className="flex items-baseline gap-1.5">
                <dt className="sr-only">{step.label}</dt>
                <dd
                  className={`font-mono text-lg font-bold ${step.count === 0 ? "text-status-declined" : "text-white"}`}
                >
                  {step.count}
                </dd>
                <span className="text-sm text-text-muted">{step.label}</span>
              </div>
            ))}
          </dl>

          <p className="mt-3">
            <span className="inline-block rounded-full border border-status-pending-surface/25 bg-status-pending-surface/10 px-3 py-1 text-xs font-semibold text-status-pending">
              {funnel.paymentsReadyTotal} payments connected
            </span>
          </p>

          {funnel.paymentsReadyButNotOnboarded.length > 0 && (
            <p className="mt-3 text-sm text-zinc-300">
              {funnel.paymentsReadyButNotOnboarded.length} connected payments
              but never finished onboarding, which makes them the closest
              people to a first paid request.
            </p>
          )}
        </div>

        <MoreDetails title="Funnel detail">
          <ol className="space-y-3">
            {funnel.steps.map((step, index) => {
              const width = Math.max((step.count / maxCount) * 100, 2);
              const zero = step.count === 0;
              return (
                <li key={step.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-zinc-200">
                      <span
                        className={`font-mono text-base font-bold ${zero ? "text-status-declined" : "text-white"}`}
                      >
                        {step.count}
                      </span>{" "}
                      {index === 0 ? "external DJs" : "of them"} {step.label}
                    </p>
                    {step.lostFromPrevious !== null &&
                      step.lostFromPrevious > 0 && (
                        <p className="shrink-0 font-mono text-xs text-status-declined">
                          {step.lostFromPrevious} lost
                        </p>
                      )}
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className={`h-full rounded-full ${zero ? "bg-status-declined/40" : "bg-white/25"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {step.definition}
                  </p>
                </li>
              );
            })}
          </ol>
        </MoreDetails>
      </Card>

      <Card variant="elevated" className="order-1 overflow-hidden md:order-3">
        <div className="space-y-3 border-b border-white/5 p-5">
          <h2 className="text-h3">
            Needs your attention{" "}
            <span className="text-text-muted">· {queue.length}</span>
          </h2>
          <p className="text-sm text-text-muted">
            Follow-ups that are due, gigs coming up, DJs waiting on a reply
            from you, and people who signed up and stalled.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTier("all")}
              aria-pressed={tier === "all"}
              className={`min-h-[44px] rounded-full border px-4 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                tier === "all"
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-white/10 bg-white/5 text-text-muted hover:text-white"
              }`}
            >
              All {queue.length}
            </button>
            {QUEUE_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                aria-pressed={tier === t}
                disabled={counts[t] === 0}
                /* A tier with nothing in it is noise on a phone: three
                   dead chips took a whole row. Hidden below md and shown
                   again the moment it has something in it, so an overdue
                   follow-up appearing tomorrow surfaces on its own. */
                className={`${counts[t] === 0 ? "hidden md:inline-block" : ""} min-h-[44px] rounded-full border px-4 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-35 ${
                  tier === t
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-white/10 bg-white/5 text-text-muted hover:text-white"
                }`}
              >
                {TIER_LABELS[t]} {counts[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {pending.length > 0 && (
            <button
              type="button"
              onClick={onGoToReports}
              className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
            >
              <Flag size={15} className="shrink-0 text-status-pending" />
              <span className="flex-1 text-sm text-zinc-200">
                {pending.length} not-played report
                {pending.length === 1 ? "" : "s"} awaiting a decision
              </span>
              <ArrowRight size={15} className="shrink-0 text-text-muted" />
            </button>
          )}

          {visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-muted">
              {queue.length === 0
                ? "Nothing waiting. No follow-ups due, no gigs this week, nobody stalled."
                : "Nothing in this group."}
            </p>
          ) : (
            shown.map((item) => {
              const contact = item.row.contact;
              const blocker = contact?.activation_blocker
                ? BLOCKER_LABELS[contact.activation_blocker as ActivationBlocker]
                : null;
              const step = contact?.next_action?.trim() || null;
              const owed = hasNextStep(contact);

              return (
                <div
                  key={item.row.key}
                  className={`border-l-2 p-4 ${tierTone[item.tier]}`}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(item.row.key)}
                    className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    {/*
                      One identity component everywhere. On a phone the
                      lifecycle badge stacks under the name rather than
                      competing with it for horizontal space, which is what
                      let long slugs collide with it before.
                    */}
                    <ContactIdentity row={item.row} />

                    {/* Stage and timing share one quiet meta line instead of
                        each claiming its own coloured row. */}
                    <span
                      className={`mt-2 block font-mono text-xs ${stampTone[item.tier]}`}
                    >
                      {item.stamp}
                      {contact?.last_contact_at &&
                        ` · last contact ${relativeDays(contact.last_contact_at).toLowerCase()}`}
                    </span>

                    {blocker && (
                      <span className="mt-2 block text-sm text-status-pending">
                        {blocker}
                      </span>
                    )}

                    <span className="mt-1.5 block text-sm text-zinc-200">
                      {step ? (
                        <>
                          <span className="text-text-muted">Next: </span>
                          {step}
                        </>
                      ) : (
                        <span className="text-text-muted">
                          Waiting on a reply from them
                        </span>
                      )}
                    </span>
                  </button>

                  {/*
                    Log is the primary action everywhere. Later only appears
                    when there is a step to postpone, and Done is not offered
                    here at all: completing a task you cannot see on the row
                    was the confusion this redesign exists to remove.
                  */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => onOpen(item.row.key, "log")}
                      disabled={!contact}
                    >
                      <MessageSquarePlus size={14} className="mr-1.5" />
                      Log
                    </Button>
                    {owed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => onLater(item.row, 7)}
                      >
                        <Clock size={14} className="mr-1.5" />
                        Later
                      </Button>
                    )}
                  </div>

                  {!contact && (
                    <p className="mt-2 text-xs text-text-muted">
                      No CRM context yet. Open to add it.
                    </p>
                  )}
                </div>
              );
            })
          )}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 p-4 text-sm font-semibold text-accent transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
            >
              View all {visible.length}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </Card>

      {newThisWeek.length > 0 && (
        <Card variant="elevated" className="order-4 overflow-hidden">
          <div className="border-b border-white/5 p-5">
            <h2 className="text-h3">Signed up this week</h2>
          </div>
          <ul className="divide-y divide-white/5">
            {newThisWeek.map((d) => {
              const id = displayIdentity(d.dj_name, d.slug);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(`dj:${d.id}`)}
                    className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate font-semibold text-white ${id.isSlug ? "font-mono text-sm" : ""}`}
                      >
                        {id.primary}
                      </span>
                      <span className="block font-mono text-xs text-text-muted">
                        joined {joinedLabel(d.created_at)} ·{" "}
                        {d.onboarding_complete
                          ? "onboarded"
                          : "not onboarded"}
                      </span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
