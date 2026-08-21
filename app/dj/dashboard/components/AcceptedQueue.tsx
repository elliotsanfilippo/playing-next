"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Clock,
  Headphones,
  MoreVertical,
  Play,
} from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import { transition } from "@/src/lib/motion";
import Card from "@/src/components/ui/Card";
import RequestCard from "@/src/components/product/RequestCard";
import { cn } from "@/src/lib/cn";

type Direction = "up" | "down" | "top";

type Props = {
  acceptedRequests: SongRequest[];
  currentPlayingNext: SongRequest | undefined;
  moveAcceptedRequest: (
    requestId: string,
    direction: Direction
  ) => Promise<void>;
  updateRequestStatus: (
    requestId: string,
    status: string
  ) => Promise<void>;
  /** So the empty copy doesn't imply nothing has come in when requests
   *  are in fact sitting in Needs You. */
  pendingCount: number;
};

/**
 * How long an accepted request can sit unplayed before it is worth
 * mentioning. Below this, a queue with things in it is just a queue.
 */
const STALE_AFTER_MINUTES = 60;

export default function AcceptedQueue({
  acceptedRequests,
  currentPlayingNext,
  moveAcceptedRequest,
  updateRequestStatus,
  pendingCount,
}: Props) {
  const shouldReduceMotion = useReducedMotion();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);

  /*
   * Reordering is scoped to a request's own VIP tier in
   * moveAcceptedRequest — a non-VIP request can never move above a VIP
   * one. So "is this move valid?" is a question about position within
   * the tier, not within the whole queue: the first non-VIP request
   * cannot move up even though it may be fifth overall.
   */
  const tierOf = (request: SongRequest) =>
    acceptedRequests.filter((other) => other.is_vip === request.is_vip);

  const tierIndexOf = (request: SongRequest) =>
    tierOf(request).findIndex((other) => other.id === request.id);

  const canMoveUp = (request: SongRequest) => tierIndexOf(request) > 0;
  const canMoveDown = (request: SongRequest) =>
    tierIndexOf(request) < tierOf(request).length - 1;
  const canPlayNext = !currentPlayingNext;

  /*
   * The old reminder lived in the notifications card and fired on
   * acceptedRequests.length — meaning any non-empty queue. It restated
   * a number already shown in the Tonight strip and again in this
   * card's own count chip, and its action was "View queue" pointing at
   * the queue directly above it.
   *
   * The real operational risk is not having a queue, it is accepting
   * tracks and never marking them played: the played count and the
   * guest-facing "not played" flow both drift when that happens. So the
   * reminder is now about age, sits inside the queue it concerns, and
   * carries no redundant link.
   */
  /*
   * The clock is state driven by a timer rather than Date.now() read
   * during render: reading the clock while rendering makes the output
   * depend on when React happens to re-render, and the reminder would
   * also never update on its own while the DJ sat on the page. 0 means
   * "not measured yet", which renders nothing — the first reading lands
   * a tick after mount, which is imperceptible for a reminder.
   */
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 60_000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const staleCount =
    now === 0
      ? 0
      : acceptedRequests.filter((request) => {
          if (!request.accepted_at) return false;

          const minutes =
            (now - new Date(request.accepted_at).getTime()) / 60_000;

          return minutes >= STALE_AFTER_MINUTES;
        }).length;

  const run = async (id: string, fn: () => Promise<void>) => {
    if (busyId) return;

    setBusyId(id);
    setSheetId(null);

    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  const move = (request: SongRequest, direction: Direction) =>
    run(request.id, () => moveAcceptedRequest(request.id, direction));

  const playNext = (request: SongRequest) =>
    run(request.id, () => updateRequestStatus(request.id, "playing_next"));

  const sheetRequest = acceptedRequests.find((r) => r.id === sheetId);

  return (
    /* lg:h-full + flex column so the card can fill an equalised grid
       row on desktop. Below lg it sizes to its own content. */
    <Card className="flex flex-col lg:h-full">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-300">
          Queue
        </h2>

        <span className="text-sm font-bold tabular-nums text-zinc-500">
          {acceptedRequests.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {acceptedRequests.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-zinc-600">
              <Headphones size={18} />
            </div>

            <p className="text-sm font-semibold text-zinc-300">
              Queue is empty
            </p>

            <p className="mt-1 text-[13px] text-zinc-600">
              {pendingCount > 0
                ? `Accept from Needs You and requests line up here. ${pendingCount} waiting.`
                : "Requests you accept line up here."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {acceptedRequests.map((request, index) => {
              const busy = busyId === request.id;

              return (
                <RequestCard
                  key={request.id}
                  title={request.song_title}
                  artist={request.artist}
                  isVip={request.is_vip}
                  hasShoutout={
                    request.request_type === "song_message" &&
                    Boolean(request.message)
                  }
                  position={index + 1}
                  size="compact"
                  animateLayout
                  interactive={false}
                  /*
                   * Neutral, not accent. Every accepted row used to carry
                   * the green accepted tone, so a full queue was a stack
                   * of green-outlined blocks shouting at the same volume
                   * as Playing Next. Sitting inside the Queue section
                   * already says these are accepted; accent is reserved
                   * for the live action and for what is actually playing
                   * next. VIP keeps its amber rank chip.
                   *
                   * No amount either. The figure earns its place in
                   * Needs You where it informs the accept decision; once
                   * accepted it is settled, and here it only competed
                   * with the song for the row's width.
                   */
                  className={cn(
                    "transition-opacity",
                    busyId && !busy && "opacity-40"
                  )}
                  meta={
                    <>
                      {/*
                        Play next stays on the row at every width: it is
                        the live action, not a management one. Compact,
                        because a word-button per row on top of three
                        move buttons is what made the queue read as a
                        toolbar. 44px on a phone, tighter on desktop
                        where the pointer is precise. The label rides on
                        aria-label and the tooltip, and both say "play
                        next" rather than "play" so it cannot be mistaken
                        for ordinary audio playback.
                      */}
                      <button
                        type="button"
                        onClick={() => playNext(request)}
                        disabled={Boolean(busyId) || !canPlayNext}
                        aria-label={
                          canPlayNext
                            ? `Make ${request.song_title} play next`
                            : `Cannot play ${request.song_title} next, something is already playing next`
                        }
                        title={
                          canPlayNext
                            ? "Play next"
                            : "Something is already playing next"
                        }
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/10 text-accent transition hover:bg-accent-strong hover:text-black disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-transparent disabled:text-zinc-700 lg:h-9 lg:w-9"
                      >
                        <Play size={15} />
                      </button>

                      {/* Reordering is management, so it lives behind the
                          menu at every width now, not only on phones. */}
                      <button
                        type="button"
                        onClick={() => setSheetId(request.id)}
                        disabled={Boolean(busyId)}
                        aria-label={`Reorder ${request.song_title}`}
                        title="Reorder"
                        /* 44x44 at every width. The glyph stays small;
                           only the target is comfortable. */
                        className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                      >
                        <MoreVertical size={17} />
                      </button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}

        {/*
          Contextual, inside the thing it is about, with no link back to
          the list the DJ is already looking at.

          Amber, per the semantic scale: red is a new unresolved request
          needing immediate attention, amber is something worth checking,
          green is accepted or live. This is the middle one — it should
          be noticeable without reading as an alarm.

          The wording stays neutral. A long queue, or a track
          deliberately held for later in the set, are both normal, so
          age alone does not mean anything is wrong; the colour makes it
          visible, the copy keeps it a nudge rather than a telling-off.
        */}
        {staleCount > 0 && (
          <div className="mt-3 flex items-start gap-2.5 rounded-control border border-status-pending-surface/20 bg-status-pending-surface/[0.07] px-3 py-2.5">
            <Clock
              size={14}
              className="mt-0.5 shrink-0 text-status-pending"
              aria-hidden
            />

            <div className="min-w-0">
              <p className="text-xs font-semibold text-status-pending">
                Still in your queue
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
              {staleCount === 1
                ? "One request has"
                : `${staleCount} requests have`}{" "}
                been waiting a while. Mark tracks as played when you spin
                them to keep your count and guest updates right.
              </p>
            </div>
          </div>
        )}
      </div>

      {/*
        ── Reorder sheet ────────────────────────────────────────────
        Portalled to <body> rather than rendered in place.

        Card's flat variant carries backdrop-blur-xl, and
        backdrop-filter makes an element a containing block for
        position:fixed descendants — so a sheet rendered inside the
        queue card resolved "fixed" against the card instead of the
        viewport. Measured: the backdrop meant to cover the screen
        rendered at 496..865 on an 812px viewport, and the sheet hung
        53px below the fold. A portal takes the overlay out of that
        subtree entirely, which is where an overlay belongs anyway.
      */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {sheetRequest && (
              <>
                <motion.div
                  className="fixed inset-0 z-50 bg-black/60"
                  initial={shouldReduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSheetId(null)}
                />

                <motion.div
                  role="dialog"
                  aria-label={`Reorder ${sheetRequest.song_title}`}
                  className="fixed inset-x-0 bottom-0 z-50 rounded-t-card border-t border-white/10 bg-surface-overlay pb-[max(env(safe-area-inset-bottom),1rem)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-80 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:border sm:pb-2"
                  initial={
                    shouldReduceMotion ? false : { opacity: 0, y: 24 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  transition={transition.state}
                >
                  <div className="border-b border-white/10 px-5 py-4">
                    <p className="truncate text-[15px] font-bold">
                      {sheetRequest.song_title}
                    </p>
                    <p className="truncate text-sm text-zinc-500">
                      {sheetRequest.artist}
                    </p>
                  </div>

                  <div className="p-2">
                    <SheetAction
                      icon={<ChevronsUp size={18} />}
                      label="Move to top"
                      hint={
                        canMoveUp(sheetRequest)
                          ? undefined
                          : sheetRequest.is_vip
                            ? "Already first"
                            : "Already first (VIP requests stay above)"
                      }
                      disabled={!canMoveUp(sheetRequest)}
                      onClick={() => move(sheetRequest, "top")}
                    />
                    <SheetAction
                      icon={<ChevronUp size={18} />}
                      label="Move up"
                      disabled={!canMoveUp(sheetRequest)}
                      onClick={() => move(sheetRequest, "up")}
                    />
                    <SheetAction
                      icon={<ChevronDown size={18} />}
                      label="Move down"
                      hint={
                        canMoveDown(sheetRequest) ? undefined : "Already last"
                      }
                      disabled={!canMoveDown(sheetRequest)}
                      onClick={() => move(sheetRequest, "down")}
                    />
                  </div>

                  <div className="px-2 pb-1">
                    <button
                      type="button"
                      onClick={() => setSheetId(null)}
                      className="flex h-12 w-full items-center justify-center rounded-control text-sm font-bold text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </Card>
  );
}

function SheetAction({
  icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 w-full items-center gap-3.5 rounded-control px-3.5 text-left transition active:bg-white/10 disabled:opacity-40 enabled:hover:bg-white/5 sm:min-h-12"
    >
      <span className="shrink-0 text-zinc-400">{icon}</span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-white">
          {label}
        </span>
        {hint && (
          <span className="block truncate text-xs text-zinc-500">{hint}</span>
        )}
      </span>
    </button>
  );
}
