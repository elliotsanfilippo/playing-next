"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Music2, ChevronsUp, ChevronUp, ChevronDown, Check, MousePointer2 } from "lucide-react";
import Badge from "@/src/components/ui/Badge";

type Track = {
  id: string;
  title: string;
  artist: string;
  price: string;
};

const ROTATION: Track[] = [
  { id: "r1", title: "Free Your Mind", artist: "Prospa", price: "£5" },
  { id: "r2", title: "Feel So Close", artist: "Calvin Harris", price: "£5" },
  { id: "r3", title: "One More Time", artist: "Daft Punk", price: "£8" },
  { id: "r4", title: "Levels", artist: "Avicii", price: "£6" },
  { id: "r5", title: "Don't You Worry Child", artist: "Swedish House Mafia", price: "£5" },
  { id: "r6", title: "Titanium", artist: "David Guetta", price: "£7" },
];

type Phase = "incoming" | "accepting" | "settled";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * A looping, non-interactive demo of the real request lifecycle
 * (incoming → accepted → queued → playing next → played), auto-playing
 * behind the hero copy so the product demonstrates itself rather than
 * being described. Respects prefers-reduced-motion by rendering one
 * static settled state instead of starting the loop.
 *
 * The incoming-request notification floats entirely above the card
 * (not inside it) specifically so it never overlaps the stats or
 * queue — an earlier version nested it inside the "Playing Next"
 * section and it visually collided with the content above it.
 *
 * Enter animations here are plain CSS keyframes triggered by a React
 * `key` remount, not Motion's AnimatePresence — in testing,
 * AnimatePresence's exit-then-enter handoff (mode="wait", and even
 * plain conditional exit) reliably left elements stuck invisible at
 * their initial/exit values instead of completing, despite correct
 * DOM/props. `layout` (pure position tracking, no exit choreography)
 * didn't show that failure mode, so it's still used for repositioning
 * the persisting queue items.
 */
export default function DashboardPreview() {
  const shouldReduceMotion = useReducedMotion();

  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<Phase>(shouldReduceMotion ? "settled" : "incoming");
  const [playingNext, setPlayingNext] = useState<Track>(ROTATION[3]);
  const [queue, setQueue] = useState<Track[]>([ROTATION[4], ROTATION[5], ROTATION[0]]);
  const [stats, setStats] = useState({ pending: 6, queue: 4, played: 23 });

  const incoming = ROTATION[cycle % ROTATION.length];
  const showToast = phase === "incoming" || phase === "accepting";

  useEffect(() => {
    if (shouldReduceMotion) return;

    let cancelled = false;

    const runCycle = async () => {
      setPhase("incoming");
      await wait(2200);
      if (cancelled) return;

      setStats((s) => ({ ...s, pending: s.pending + 1 }));
      setPhase("accepting");
      await wait(1000);
      if (cancelled) return;

      setQueue((q) => [playingNext, q[0], q[1]]);
      setPlayingNext(incoming);
      setStats((s) => ({ ...s, pending: s.pending - 1, played: s.played + 1 }));
      setPhase("settled");
      await wait(3400);
      if (cancelled) return;

      setCycle((c) => c + 1);
    };

    runCycle();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, shouldReduceMotion]);

  return (
    <div className="relative mx-auto w-full max-w-2xl pt-10 sm:pt-12">
      {/* Two-tone ambient glow — a single flat color reads flat; layering
          the accent green with a deep indigo behind it sells "club
          lighting" depth instead of a plain colored blob. */}
      <motion.div
        className="pointer-events-none absolute -inset-x-6 -top-4 bottom-1/3 rounded-full bg-indigo-500/20 blur-[100px]"
        animate={
          shouldReduceMotion
            ? undefined
            : { opacity: [0.5, 0.8, 0.5], x: [-8, 8, -8] }
        }
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-card-lg bg-green-500/15 blur-[90px]"
        animate={
          shouldReduceMotion
            ? undefined
            : { opacity: [0.7, 1, 0.7], scale: [1, 1.06, 1] }
        }
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Incoming request notification — floats above the whole card, never overlapping its content */}
      {showToast && (
        <div
          key={`toast-${incoming.id}`}
          className="animate-toast-in absolute -top-2 right-2 z-20 w-[78%] max-w-[15.5rem] rounded-2xl border border-white/10 bg-[#1b1d21]/95 p-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:right-4 sm:max-w-[17rem]"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-400">
              <Music2 size={15} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                New request
              </p>
              <p className="truncate text-sm font-semibold">{incoming.title}</p>
            </div>

            <span className="animate-pop-in shrink-0 text-sm font-bold text-accent">
              {incoming.price}
            </span>
          </div>

          <div className="relative mt-2.5 flex justify-end gap-2">
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-400">
              Decline
            </span>

            <span
              className={`relative flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-black transition-colors duration-300 ${
                phase === "accepting" ? "bg-green-400" : "bg-accent-strong"
              }`}
            >
              {phase === "accepting" ? (
                <>
                  <Check size={12} /> Accepted
                </>
              ) : (
                "Accept"
              )}

              {!shouldReduceMotion && (
                <span className="animate-click-ring pointer-events-none absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full border-2 border-accent" />
              )}
            </span>

            {!shouldReduceMotion && (
              <MousePointer2
                size={18}
                className="animate-cursor-click pointer-events-none absolute -right-1 -top-1 fill-white text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
              />
            )}
          </div>
        </div>
      )}

      <div className="relative overflow-visible rounded-card-lg border border-white/15 bg-[#111315]/70 p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-5">
        <div className="mb-3 flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        </div>

        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              DJ dashboard
            </p>

            <h2 className="mt-1 font-bold">Overview</h2>
          </div>

          <Badge tone="accent" dot>
            Live
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {(
            [
              ["Pending", stats.pending],
              ["Queue", stats.queue],
              ["Played", stats.played],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:p-4"
            >
              <p className="text-[11px] text-zinc-500 sm:text-xs">{label}</p>

              <p
                key={value}
                className="animate-tick-in mt-2 text-2xl font-bold sm:text-3xl"
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="relative mt-4 rounded-2xl border border-accent/15 bg-accent/[0.06] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Playing next
          </p>

          <div
            key={playingNext.id}
            className="animate-slide-in mt-3 flex items-center gap-3"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500">
              <Music2 size={20} className="text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{playingNext.title}</p>
              <p className="truncate text-sm text-zinc-500">{playingNext.artist}</p>
            </div>

            <div className="flex shrink-0 gap-2">
              <span className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400">
                Decline
              </span>
              <span className="rounded-xl bg-accent-strong px-3 py-2 text-xs font-bold text-black">
                Accept
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Accepted queue</p>
            <p className="text-xs text-zinc-600">{stats.queue} requests</p>
          </div>

          <div className="mt-3 space-y-2">
            {queue.map((track, index) => (
              <motion.div
                key={track.id}
                layout
                className="animate-drop-in rounded-xl bg-white/[0.025] p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-zinc-500">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{track.title}</p>
                    <p className="truncate text-xs text-zinc-600">{track.artist}</p>
                  </div>

                  <span className="text-xs text-zinc-500">{track.price}</span>
                </div>

                <div className="mt-2 flex gap-1.5 pl-10">
                  <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-zinc-400">
                    <ChevronsUp size={11} /> Top
                  </span>
                  <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-zinc-400">
                    <ChevronUp size={11} /> Up
                  </span>
                  <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-zinc-400">
                    <ChevronDown size={11} /> Down
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
