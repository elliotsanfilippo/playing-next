"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { Check, Crown, Music2 } from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import { DECLINE_REASONS } from "@/src/lib/declineReasons";
import { SPRING, transition } from "@/src/lib/motion";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";
import MoneyValue from "@/src/components/product/MoneyValue";
import RequestCard from "@/src/components/product/RequestCard";

type Props = {
  pendingRequests: SongRequest[];
  acceptRequest: (request: SongRequest) => Promise<void>;
  declineRequest: (
    request: SongRequest,
    declineReason?: string | null
  ) => Promise<void>;
};

type Action = { id: string; kind: "accept" | "decline" };

/*
 * The arrival treatment is carried by variants rather than by tracking
 * which ids are new.
 *
 * <AnimatePresence initial={false}> skips the enter animation for rows
 * that were already there on first render, and Motion propagates the
 * variant state to children — so the attention flash below runs only
 * for a request that actually arrived while the DJ was watching. Rows
 * present at page load jump straight to the resting state and never
 * flash, which is what stops every dashboard load looking like a burst
 * of arrivals.
 *
 * Tracking it by hand would mean reading a ref during render, which is
 * exactly the pattern that makes a component miss updates.
 */
const rowVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
  gone: { opacity: 0, scale: 0.97, transition: { duration: 0.16 } },
};

/** One shot, ending back at zero so it leaves nothing behind. */
const flashVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: [0, 0.55, 0],
    transition: { duration: 0.7, times: [0, 0.3, 1], ease: "easeOut" },
  },
  gone: { opacity: 0 },
};

export default function PendingRequests({
  pendingRequests,
  acceptRequest,
  declineRequest,
}: Props) {
  const shouldReduceMotion = useReducedMotion();

  /*
   * One in-flight action at a time, and which kind it is. This doubles
   * as the "resolved" display state: while an accept is running the row
   * shows its accepted treatment, and if the action fails the row is
   * still in `pendingRequests` when processing ends, so it reverts on
   * its own. No separate success flag to get out of sync with reality —
   * acceptRequest returns normally after a failed Stripe capture, so a
   * flag would have stuck on "Accepted" for a request that is still
   * pending.
   */
  const [action, setAction] = useState<Action | null>(null);

  /*
   * Which request is currently showing its reason picker. Declining
   * stays a two-tap action — tap Decline, tap a reason — rather than
   * opening a modal, because this gets used one-handed mid-set and a
   * dialog is the last thing a DJ wants over their queue.
   */
  const [choosingReasonId, setChoosingReasonId] = useState<string | null>(
    null
  );

  const runDecline = async (
    request: SongRequest,
    declineReason: string | null
  ) => {
    if (action) return;

    setAction({ id: request.id, kind: "decline" });

    try {
      await declineRequest(request, declineReason);
      setChoosingReasonId(null);
    } finally {
      setAction(null);
    }
  };

  const runAccept = async (request: SongRequest) => {
    if (action) return;

    /*
     * State is set before awaiting, so the row resolves the instant the
     * DJ taps. The Stripe capture and the refetch behind it are
     * unchanged and are not waited on for feedback.
     */
    setAction({ id: request.id, kind: "accept" });

    try {
      await acceptRequest(request);
    } finally {
      setAction(null);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-300">
          Needs you
        </h2>

        <span
          className={
            pendingRequests.length > 0
              ? "flex h-7 min-w-7 items-center justify-center rounded-full bg-status-pending-surface/15 px-2 text-sm font-bold tabular-nums text-status-pending"
              : "flex h-7 min-w-7 items-center justify-center rounded-full bg-white/5 px-2 text-sm font-bold tabular-nums text-zinc-500"
          }
        >
          {pendingRequests.length}
        </span>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        {pendingRequests.length === 0 ? (
          <div className="rounded-card border border-dashed border-white/10 px-6 py-9 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-zinc-500">
              <Music2 size={20} />
            </div>

            <h3 className="text-base font-semibold">Nothing waiting</h3>

            <p className="mt-1.5 text-sm text-zinc-500">
              New requests land here the moment they arrive.
            </p>
          </div>
        ) : (
          /*
           * initial={false} is what makes the arrival treatment
           * one-shot and honest: rows present on first render do not
           * animate in, rows added afterwards do.
           */
          <AnimatePresence initial={false}>
            {pendingRequests.map((request) => {
              const busy = action?.id === request.id;
              const accepting = busy && action?.kind === "accept";
              const declining = busy && action?.kind === "decline";
              const choosing = choosingReasonId === request.id;

              const message =
                request.request_type === "song_message" && request.message
                  ? request.message
                  : null;

              return (
                <motion.div
                  key={request.id}
                  layout={shouldReduceMotion ? false : "position"}
                  variants={rowVariants}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  exit="gone"
                  transition={SPRING.tight}
                  className="relative"
                >
                  {/* The card itself never turns red — with several
                      requests waiting, a wall of red surfaces is noise
                      rather than attention. */}
                  {!shouldReduceMotion && (
                    <motion.span
                      aria-hidden
                      variants={flashVariants}
                      className="pointer-events-none absolute inset-0 rounded-card ring-2 ring-attention"
                    />
                  )}

                  <RequestCard
                    title={request.song_title}
                    artist={request.artist}
                    isVip={request.is_vip}
                    interactive={false}
                    tone={accepting ? "accepted" : "default"}
                    indicator={
                      /*
                       * The persistent unresolved marker. A dot, not a
                       * red card: with several requests waiting, a wall
                       * of red surfaces is noise rather than attention.
                       * It resolves to a green check the moment the DJ
                       * accepts.
                       */
                      <span
                        className="mt-2 flex h-2.5 w-2.5 shrink-0 items-center justify-center"
                        aria-hidden
                      >
                        {accepting ? (
                          <Check size={12} strokeWidth={3} className="text-accent" />
                        ) : (
                          <span className="h-2.5 w-2.5 rounded-full bg-attention" />
                        )}
                      </span>
                    }
                    meta={
                      request.is_vip ? (
                        <Badge tone="warning">
                          <Crown size={12} /> VIP
                        </Badge>
                      ) : null
                    }
                    actions={
                      choosing ? null : (
                        <div className="flex w-full gap-2.5">
                          <Button
                            variant="secondary"
                            className="h-12 flex-1 sm:h-11"
                            disabled={Boolean(action)}
                            onClick={() => setChoosingReasonId(request.id)}
                          >
                            Decline
                          </Button>

                          <Button
                            variant="accent"
                            className="h-12 flex-[1.4] sm:h-11"
                            disabled={Boolean(action)}
                            onClick={() => runAccept(request)}
                          >
                            {accepting ? (
                              <>
                                <Check size={16} strokeWidth={3} />
                                Accepted
                              </>
                            ) : (
                              "Accept"
                            )}
                          </Button>
                        </div>
                      )
                    }
                  >
                    {/* Hierarchy below the identity row: what the guest
                        said, then what it is worth. The message is the
                        thing a DJ has to act on; the amount informs the
                        decision without competing for it. */}
                    {message && (
                      <p
                        title={message}
                        className="mt-2.5 line-clamp-3 rounded-control border border-white/5 bg-white/[0.04] px-3 py-2 text-[13px] italic leading-5 text-zinc-200"
                      >
                        &ldquo;{message}&rdquo;
                      </p>
                    )}

                    {request.dj_earnings !== null &&
                      request.dj_earnings > 0 && (
                        <p className="mt-2.5 flex items-baseline gap-1.5 text-xs text-zinc-500">
                          You earn
                          <MoneyValue
                            pence={request.dj_earnings}
                            compact={false}
                            className="text-sm font-semibold text-zinc-300"
                          />
                        </p>
                      )}

                    <AnimatePresence initial={false}>
                      {choosing && (
                        <motion.div
                          initial={
                            shouldReduceMotion
                              ? false
                              : { height: 0, opacity: 0 }
                          }
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={transition.state}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 border-t border-white/5 pt-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                Why? (optional)
                              </p>

                              <button
                                type="button"
                                disabled={declining}
                                onClick={() => setChoosingReasonId(null)}
                                className="text-xs font-semibold text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
                              >
                                Back
                              </button>
                            </div>

                            <div className="mt-2.5 flex flex-wrap gap-2">
                              {DECLINE_REASONS.map((reason) => (
                                <button
                                  key={reason.key}
                                  type="button"
                                  disabled={declining}
                                  onClick={() => runDecline(request, reason.key)}
                                  /* min-h-11: these are confirmation
                                     targets tapped one-handed mid-set,
                                     so they clear 44px like the primary
                                     actions do. */
                                  className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 text-[13px] font-semibold text-zinc-200 transition hover:border-status-declined/40 hover:bg-status-declined/10 hover:text-status-declined disabled:opacity-50"
                                >
                                  {reason.djLabel}
                                </button>
                              ))}

                              <button
                                type="button"
                                disabled={declining}
                                onClick={() => runDecline(request, null)}
                                className="inline-flex min-h-11 items-center rounded-full px-4 text-[13px] font-semibold text-zinc-500 underline underline-offset-4 transition hover:text-zinc-300 disabled:opacity-50"
                              >
                                {declining ? "Declining..." : "No reason"}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </RequestCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </Card>
  );
}
