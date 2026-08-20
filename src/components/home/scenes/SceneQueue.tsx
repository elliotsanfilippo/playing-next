"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Music2, Check } from "lucide-react";
import RequestCard from "@/src/components/product/RequestCard";
import Badge from "@/src/components/ui/Badge";
import Reveal from "./Reveal";
import { SPRING } from "@/src/lib/motion";

type Props = {
  /** True once the visitor accepted the opening request — the newly
   *  accepted track then appears in this queue as the payoff. */
  accepted: boolean;
};

/** The queue as it stands before the visitor's own accept lands. */
const BASE_QUEUE = [
  { id: "q1", title: "Free Your Mind", artist: "Prospa", pence: 500 },
  { id: "q2", title: "Feel So Close", artist: "Calvin Harris", pence: 500 },
  { id: "q3", title: "One More Time", artist: "Daft Punk", pence: 800 },
];

const ACCEPTED_TRACK = {
  id: "q4-levels",
  title: "Levels",
  artist: "Avicii",
  pence: 500,
};

/*
 * Scene 2 — the payoff for accepting.
 *
 * The queue rows here are the real <RequestCard> the DJ dashboard
 * renders, not a marketing lookalike. That's the whole point: the
 * visitor accepted a request a moment ago, and now watches it drop
 * into the same interface they'd use for real.
 *
 * When `accepted` is true the Levels row animates in at the end of the
 * queue; when it's false (visitor scrolled past without clicking) the
 * queue simply shows three tracks and the scene still reads correctly.
 */
export default function SceneQueue({ accepted }: Props) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="dashboard"
      className="relative z-10 px-5 py-24 sm:px-6 sm:py-32 lg:px-8"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="min-w-0">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Your booth, your call
            </p>
          </Reveal>

          <Reveal index={1}>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              You&apos;re still in control.
            </h2>
          </Reveal>

          <Reveal index={2}>
            <p className="mt-5 max-w-md text-lg leading-8 text-zinc-400">
              Accept, decline and reorder paid requests without
              interrupting your set. Nothing reaches your speakers
              unless you say so.
            </p>
          </Reveal>
        </div>

        <Reveal index={1} className="min-w-0">
          <div className="relative rounded-card-lg border border-white/15 bg-surface-raised/70 p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -top-8 h-48 rounded-full bg-green-500/10 blur-[90px]"
            />

            <div className="relative flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Accepted queue
                </p>
                <h3 className="mt-1 text-xl font-bold">Tonight</h3>
              </div>

              <Badge tone="accent" dot>
                Live
              </Badge>
            </div>

            <div className="relative mt-4 space-y-2">
              {BASE_QUEUE.map((track, index) => (
                <RequestCard
                  key={track.id}
                  title={track.title}
                  artist={track.artist}
                  position={index + 1}
                  pence={track.pence}
                  size="compact"
                  animateLayout
                />
              ))}

              <AnimatePresence>
                {accepted && (
                  <motion.div
                    key={ACCEPTED_TRACK.id}
                    initial={
                      shouldReduceMotion
                        ? false
                        : { opacity: 0, y: -18, scale: 0.96 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={SPRING.soft}
                    className="relative"
                  >
                    <RequestCard
                      title={ACCEPTED_TRACK.title}
                      artist={ACCEPTED_TRACK.artist}
                      position={BASE_QUEUE.length + 1}
                      pence={ACCEPTED_TRACK.pence}
                      size="compact"
                      className="border-accent/30 bg-accent/[0.06]"
                      meta={
                        <motion.span
                          initial={
                            shouldReduceMotion ? false : { scale: 0, opacity: 0 }
                          }
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ ...SPRING.tight, delay: 0.25 }}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-black"
                        >
                          <Check size={12} strokeWidth={3} />
                        </motion.span>
                      }
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Playing Next — the next beat in the story. */}
            <div className="relative mt-6 rounded-2xl border border-accent/15 bg-accent/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                Playing next
              </p>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500">
                  <Music2 size={20} className="text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">Free Your Mind</p>
                  <p className="truncate text-sm text-zinc-500">Prospa</p>
                </div>

                <motion.span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent"
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { opacity: [1, 0.35, 1], scale: [1, 0.85, 1] }
                  }
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
