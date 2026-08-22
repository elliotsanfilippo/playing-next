"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Crown, Flag, Music4 } from "lucide-react";
import {
  requestStatusLabel,
  requestStatusDescription,
  requestStatusTone,
} from "@/src/lib/requestStatus";
import { declineReasonGuestCopy } from "@/src/lib/declineReasons";
import { toneDotClasses } from "@/src/components/ui/Badge";
import type { GuestRequest } from "@/src/lib/useRequestStatus";
import { cn } from "@/src/lib/cn";

/* Status word only. Deliberately not Badge's surface classes, which
   also set a background and would tint everything inside the card. */
const TONE_TEXT: Record<string, string> = {
  accent: "text-status-accepted",
  danger: "text-status-declined",
  warning: "text-status-pending",
  info: "text-status-playing",
  neutral: "text-zinc-400",
};

type Props = {
  request: GuestRequest;
  /** Extra emphasis for the single-request confirmation view. */
  feature?: boolean;
};

/*
 * One request's live state.
 *
 * Everything a guest is told about what a status means now comes from
 * requestStatus.ts. The only copy assembled here is the decline reason,
 * which is per-request rather than per-status.
 */
export default function RequestStatusCard({ request, feature = false }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const status = request.request_status;
  const tone = requestStatusTone(status);
  const label = requestStatusLabel(status, "guest");
  const description = requestStatusDescription(status);
  const declineReason =
    status === "declined"
      ? declineReasonGuestCopy(request.decline_reason)
      : null;

  /*
   * Motion keys off the status itself, so a re-render caused by the
   * 4-second poll finding nothing new animates nothing. Only a real
   * transition — pending to accepted, accepted to playing next — plays.
   */
  const [changed, setChanged] = useState(false);
  const previousStatus = useRef(status);

  useEffect(() => {
    if (previousStatus.current === status) return;
    previousStatus.current = status;
    setChanged(true);
    const timer = setTimeout(() => setChanged(false), 900);
    return () => clearTimeout(timer);
  }, [status]);

  const isUpNext = status === "playing_next";

  return (
    <motion.div
      /* The key makes Motion treat a status change as a new element, so
         the transition happens on change and never on a poll. */
      key={status}
      initial={shouldReduceMotion || !changed ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
      }
      /*
       * The tone colours the dot and the status word, never the card.
       *
       * Reusing Badge's toneSurfaceClasses here tinted the whole surface
       * and, because those classes carry a text colour, the song title
       * inherited it — a waiting request rendered its track name in
       * amber. It also framed "waiting for the DJ" as a warning, when it
       * is simply what every request looks like for its first minute.
       * Only "up next" earns a coloured surface, because that one really
       * is a change worth feeling.
       */
      className={cn(
        "rounded-card border p-3.5 sm:p-5",
        isUpNext
          ? "border-accent/30 bg-accent/[0.07]"
          : "border-white/10 bg-surface-raised"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            isUpNext ? "bg-accent" : toneDotClasses[tone]
          )}
        />
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.18em]",
            isUpNext ? "text-accent" : TONE_TEXT[tone]
          )}
        >
          {/* The emotional peak of the guest flow, and the only place the
              copy departs from the canonical label — "Playing Next" is
              the state, "You're up next" is what it means to the person
              who asked for it. */}
          {isUpNext ? "You're up next" : label}
        </p>

        {request.is_vip && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            <Crown size={10} aria-hidden /> VIP
          </span>
        )}
      </div>

      <h2
        className={cn(
          "mt-2.5 flex items-center gap-1.5 font-bold tracking-tight",
          feature ? "text-xl sm:text-2xl" : "text-base"
        )}
      >
        <span className="min-w-0 truncate">{request.song_title}</span>
      </h2>

      <p className="mt-0.5 truncate text-sm text-zinc-400">{request.artist}</p>

      <p className="mt-3 text-[13px] leading-5 text-zinc-300">
        {/* When the DJ gave a reason, that is the more specific answer and
            replaces the generic one rather than stacking beneath it. */}
        {declineReason ?? description}
      </p>

      {declineReason && (
        <p className="mt-1.5 text-[13px] leading-5 text-zinc-500">
          Your card was never charged.
        </p>
      )}

      {request.request_type === "song_message" && request.message && (
        <div className="mt-3 rounded-control border border-white/10 bg-black/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Your shoutout
          </p>
          <p className="mt-1 text-[13px] leading-5 text-zinc-200">
            &ldquo;{request.message}&rdquo;
          </p>
        </div>
      )}

      {/*
        Position, never an estimate of time. It moves when VIP requests
        arrive, when the DJ reorders, and when songs get played, so the
        note is there to stop "#3" reading as a promise.
      */}
      {status === "accepted" && request.queue_position !== null && (
        <div className="mt-3 flex items-center gap-3 rounded-control border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <Music4 size={15} aria-hidden className="shrink-0 text-zinc-500" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              You&apos;re #{request.queue_position} in the queue
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
              This can move as the DJ reorders their set.
            </p>
          </div>
        </div>
      )}

      {/*
        A report is a flag on the request, not a status — request_status
        stays exactly as it was. So this is stated as what the guest told
        us, never as a finding about the DJ. Playing Next cannot hear a
        room and must not imply otherwise.
      */}
      {request.reported_not_played_at && (
        <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-5 text-zinc-400">
          <Flag size={13} aria-hidden className="mt-0.5 shrink-0" />
          You reported that you didn&apos;t hear this track. We&apos;re
          looking into it.
        </p>
      )}
    </motion.div>
  );
}
