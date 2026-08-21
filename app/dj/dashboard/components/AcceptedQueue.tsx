"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Headphones,
  MoreVertical,
  Play,
} from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import { transition } from "@/src/lib/motion";
import Card from "@/src/components/ui/Card";
import MoneyValue from "@/src/components/product/MoneyValue";
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
};

export default function AcceptedQueue({
  acceptedRequests,
  currentPlayingNext,
  moveAcceptedRequest,
  updateRequestStatus,
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
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-300">
          Queue
        </h2>

        <span
          className={
            acceptedRequests.length > 0
              ? "flex h-7 min-w-7 items-center justify-center rounded-full bg-status-playing-surface/15 px-2 text-sm font-bold tabular-nums text-status-playing"
              : "flex h-7 min-w-7 items-center justify-center rounded-full bg-white/5 px-2 text-sm font-bold tabular-nums text-zinc-500"
          }
        >
          {acceptedRequests.length}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        {acceptedRequests.length === 0 ? (
          <div className="rounded-card border border-dashed border-white/10 px-6 py-9 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-zinc-500">
              <Headphones size={20} />
            </div>

            <h3 className="text-base font-semibold">Queue is empty</h3>

            <p className="mt-1.5 text-sm text-zinc-500">
              Requests you accept line up here.
            </p>
          </div>
        ) : (
          /* space-y-2: the rows previously sat flush against each other,
             which made it hard to tell which row an action belonged to. */
          <div className="space-y-2">
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
                  tone="accepted"
                  className={cn(
                    "transition-opacity",
                    busyId && !busy && "opacity-50"
                  )}
                  meta={
                    <>
                      {request.dj_earnings !== null &&
                        request.dj_earnings > 0 && (
                          <MoneyValue
                            pence={request.dj_earnings}
                            className="text-zinc-400"
                          />
                        )}

                      {/*
                        Phone: one target per row instead of four. The
                        row stays compact and the actions get a sheet
                        with targets you can actually hit one-handed.
                      */}
                      <button
                        type="button"
                        onClick={() => setSheetId(request.id)}
                        disabled={Boolean(busyId)}
                        aria-label={`Actions for ${request.song_title}`}
                        className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 lg:hidden"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {/*
                        Desktop keeps direct controls, but icon-only so a
                        row reads as a queue item with affordances rather
                        than as a toolbar. Play next keeps its label
                        because it is the consequential one.
                      */}
                      <div className="hidden shrink-0 items-center gap-1 lg:flex">
                        <IconAction
                          label={`Move ${request.song_title} to top`}
                          icon={<ChevronsUp size={15} />}
                          disabled={Boolean(busyId) || !canMoveUp(request)}
                          onClick={() => move(request, "top")}
                        />
                        <IconAction
                          label={`Move ${request.song_title} up`}
                          icon={<ChevronUp size={15} />}
                          disabled={Boolean(busyId) || !canMoveUp(request)}
                          onClick={() => move(request, "up")}
                        />
                        <IconAction
                          label={`Move ${request.song_title} down`}
                          icon={<ChevronDown size={15} />}
                          disabled={Boolean(busyId) || !canMoveDown(request)}
                          onClick={() => move(request, "down")}
                        />

                        <button
                          type="button"
                          onClick={() => playNext(request)}
                          disabled={Boolean(busyId) || !canPlayNext}
                          title={
                            canPlayNext
                              ? "Set as playing next"
                              : "Something is already playing next"
                          }
                          /* Outlined rather than filled. Four solid
                             accent buttons stacked down the queue read
                             as a toolbar and pull the eye away from the
                             songs; this stays quiet until it is the
                             thing you want, then fills on hover. */
                          className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-control border border-accent/30 bg-accent/10 px-3 text-xs font-bold text-accent transition hover:bg-accent-strong hover:text-black disabled:cursor-not-allowed disabled:border-transparent disabled:bg-white/5 disabled:text-zinc-600"
                        >
                          <Play size={13} />
                          Play next
                        </button>
                      </div>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/*
        ── Mobile action sheet ──────────────────────────────────────
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
                  className="fixed inset-0 z-50 bg-black/60 lg:hidden"
                  initial={shouldReduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSheetId(null)}
                />

                <motion.div
                  role="dialog"
                  aria-label={`Queue actions for ${sheetRequest.song_title}`}
                  className="fixed inset-x-0 bottom-0 z-50 rounded-t-card border-t border-white/10 bg-surface-overlay pb-[max(env(safe-area-inset-bottom),1rem)] lg:hidden"
                  initial={shouldReduceMotion ? false : { y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={transition.state}
                >
                  <div
                    aria-hidden
                    className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/20"
                  />

                  <div className="border-b border-white/10 px-5 py-4">
                    <p className="truncate text-base font-bold">
                      {sheetRequest.song_title}
                    </p>
                    <p className="truncate text-sm text-zinc-500">
                      {sheetRequest.artist}
                    </p>
                  </div>

                  <div className="p-2">
                    <SheetAction
                      icon={<Play size={18} />}
                      label="Play next"
                      hint={
                        canPlayNext ? undefined : "Something is already playing next"
                      }
                      disabled={!canPlayNext}
                      onClick={() => playNext(sheetRequest)}
                    />
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
                      hint={canMoveDown(sheetRequest) ? undefined : "Already last"}
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

function IconAction({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-control border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-zinc-700"
    >
      {icon}
    </button>
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
      className="flex min-h-14 w-full items-center gap-3.5 rounded-control px-3.5 text-left transition active:bg-white/10 disabled:opacity-40 enabled:hover:bg-white/5"
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
