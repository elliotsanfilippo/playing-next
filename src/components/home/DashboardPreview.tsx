"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Music2, ChevronsUp, ChevronUp, ChevronDown, Check, MousePointer2 } from "lucide-react";
import Badge from "@/src/components/ui/Badge";
import RequestCard from "@/src/components/product/RequestCard";
import MoneyValue from "@/src/components/product/MoneyValue";
import { SPRING, transition } from "@/src/lib/motion";

type Track = {
  id: string;
  title: string;
  artist: string;
  /** Pence, matching how the real product stores every amount. */
  pence: number;
};

const ROTATION: Track[] = [
  { id: "r1", title: "Free Your Mind", artist: "Prospa", pence: 500 },
  { id: "r2", title: "Feel So Close", artist: "Calvin Harris", pence: 500 },
  { id: "r3", title: "One More Time", artist: "Daft Punk", pence: 800 },
  { id: "r4", title: "Levels", artist: "Avicii", pence: 600 },
  { id: "r5", title: "Don't You Worry Child", artist: "Swedish House Mafia", pence: 500 },
  { id: "r6", title: "Titanium", artist: "David Guetta", pence: 700 },
];

type Phase = "incoming" | "accepting" | "settled";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const REORDER_CONTROLS = [
  { label: "Top", Icon: ChevronsUp },
  { label: "Up", Icon: ChevronUp },
  { label: "Down", Icon: ChevronDown },
];

/*
 * A looping, non-interactive demo of the real request lifecycle
 * (incoming → accepted → queued → playing next), auto-playing beside
 * the hero copy so the product demonstrates itself rather than being
 * described.
 *
 * The queue rows are the real <RequestCard> the DJ dashboard uses, not
 * a marketing lookalike — that's the point: someone who watches this
 * and signs up meets the same card again inside the product.
 *
 * The incoming-request notification floats entirely outside the card
 * so it never overlaps the stats or queue beneath it.
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
      {/* Two-tone ambient glow — a single flat colour reads flat; layering
          the accent green over a deep indigo sells club-lighting depth. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-4 bottom-1/3 rounded-full bg-indigo-500/20 blur-[100px]"
        animate={
          shouldReduceMotion ? undefined : { opacity: [0.5, 0.8, 0.5], x: [-8, 8, -8] }
        }
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-card-lg bg-green-500/15 blur-[90px]"
        animate={
          shouldReduceMotion ? undefined : { opacity: [0.7, 1, 0.7], scale: [1, 1.06, 1] }
        }
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <AnimatePresence>
        {showToast && (
          <motion.div
            key={`toast-${incoming.id}`}
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={SPRING.soft}
            className="absolute -top-2 right-2 z-20 w-[78%] max-w-[15.5rem] rounded-2xl border border-white/10 bg-surface-overlay/95 p-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:right-4 sm:max-w-[17rem]"
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

              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...SPRING.tight, delay: 0.15 }}
                className="shrink-0"
              >
                <MoneyValue pence={incoming.pence} className="text-accent" />
              </motion.span>
            </div>

            <div className="relative mt-2.5 flex justify-end gap-2">
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-400">
                Decline
              </span>

              <motion.span
                animate={
                  phase === "accepting" && !shouldReduceMotion
                    ? { scale: [1, 1.12, 1] }
                    : undefined
                }
                transition={transition.state}
                className={`relative flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-black transition-colors ${
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
              </motion.span>

              {/* Simulated cursor travelling to the Accept button, then
                  pressing it — reads as "someone is really using this". */}
              {!shouldReduceMotion && (
                <motion.span
                  key={`cursor-${incoming.id}`}
                  aria-hidden
                  className="pointer-events-none absolute -right-1 -top-1"
                  initial={{ opacity: 0, x: 34, y: -38 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    y: 0,
                    scale: phase === "accepting" ? [1, 0.8, 1] : 1,
                  }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                >
                  <MousePointer2
                    size={18}
                    className="fill-white text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                  />
                </motion.span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative overflow-visible rounded-card-lg border border-white/15 bg-surface-raised/70 p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-5">
        <div aria-hidden className="mb-3 flex gap-1.5">
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
              className="overflow-hidden rounded-2xl border border-white/5 bg-surface-inset p-3 sm:p-4"
            >
              <p className="text-[11px] text-zinc-500 sm:text-xs">{label}</p>

              <div className="relative mt-2 h-8 sm:h-9">
                <AnimatePresence initial={false}>
                  <motion.p
                    key={value}
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={transition.state}
                    className="absolute inset-0 text-2xl font-bold tabular-nums sm:text-3xl"
                  >
                    {value}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>

        <div className="relative mt-4 rounded-2xl border border-accent/15 bg-accent/[0.06] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Playing next
          </p>

          <div className="relative mt-3 min-h-[3rem]">
            <AnimatePresence mode="wait">
              <motion.div
                key={playingNext.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={transition.state}
                className="flex items-center gap-3"
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
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Accepted queue</p>
            <p className="text-xs text-zinc-600">{stats.queue} requests</p>
          </div>

          <div className="mt-3 space-y-2">
            {queue.map((track, index) => (
              <RequestCard
                key={track.id}
                title={track.title}
                artist={track.artist}
                position={index + 1}
                pence={track.pence}
                size="compact"
                animateLayout
                interactive={false}
                actions={REORDER_CONTROLS.map(({ label, Icon }) => (
                  <span
                    key={label}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-zinc-400"
                  >
                    <Icon size={11} /> {label}
                  </span>
                ))}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
