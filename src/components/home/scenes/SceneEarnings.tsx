"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { Crown, Heart, Music2 } from "lucide-react";
import Reveal from "./Reveal";
import { EARNINGS } from "./timings";

/*
 * Scene 5 — the money moment.
 *
 * Covers the whole revenue model rather than just song requests: paid
 * requests, VIP priority and tips are three distinct income streams in
 * the real product, and showing only the first understates it.
 *
 * All figures are illustrative and labelled as such in the UI. They're
 * built from the product's real defaults (£5 request, £1 VIP) so the
 * example is plausible, but nothing here is live data and the copy
 * must never imply otherwise.
 */
const CONTRIBUTORS = [
  {
    id: "requests",
    label: "14 song requests",
    pence: 7000,
    Icon: Music2,
    tone: "text-accent",
  },
  {
    id: "vip",
    label: "6 VIP priority",
    pence: 600,
    Icon: Crown,
    tone: "text-amber-300",
  },
  {
    id: "tips",
    label: "Tips from the floor",
    pence: 1000,
    Icon: Heart,
    tone: "text-pink-300",
  },
];

const TOTAL_PENCE = CONTRIBUTORS.reduce((sum, c) => sum + c.pence, 0);

function AnimatedTotal({ target }: { target: number }) {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const [display, setDisplay] = useState(shouldReduceMotion ? target : 0);

  useEffect(() => {
    if (!inView || shouldReduceMotion) return;

    /*
     * animate() from Motion rather than a hand-rolled rAF loop: it
     * handles interruption and cleanup, and respects the same easing
     * vocabulary as the rest of the page.
     */
    const controls = animate(0, target, {
      duration: EARNINGS.countDurationSec,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (value) => setDisplay(value),
    });

    return () => controls.stop();
  }, [inView, shouldReduceMotion, target]);

  return (
    <span ref={ref} className="tabular-nums">
      £{Math.round(display)}
    </span>
  );
}

export default function SceneEarnings() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative z-10 px-5 py-24 sm:px-6 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            The money moment
          </p>
        </Reveal>

        <Reveal index={1}>
          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Your crowd was already
            <br />
            requesting songs.
          </h2>
        </Reveal>

        <Reveal index={2}>
          <p className="mx-auto mt-5 max-w-md text-lg leading-8 text-zinc-400">
            Now those requests can pay.
          </p>
        </Reveal>

        <Reveal index={3}>
          <div className="relative mx-auto mt-14 max-w-md">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-10 rounded-full bg-green-500/12 blur-[110px]"
            />

            <div className="relative rounded-card-lg border border-white/15 bg-surface-raised/70 p-8 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                One night
              </p>

              <p className="mt-3 text-6xl font-bold tracking-[-0.03em] text-white sm:text-7xl">
                <AnimatedTotal target={TOTAL_PENCE / 100} />
              </p>

              <div className="mt-8 space-y-3 text-left">
                {CONTRIBUTORS.map((c, index) => (
                  <motion.div
                    key={c.id}
                    initial={
                      shouldReduceMotion ? false : { opacity: 0, x: -12 }
                    }
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-20%" }}
                    transition={{
                      duration: 0.45,
                      delay:
                        EARNINGS.contributorDelay +
                        index * EARNINGS.contributorStagger,
                    }}
                    className="flex items-center gap-3 rounded-control border border-white/5 bg-white/[0.03] px-4 py-3"
                  >
                    <c.Icon size={16} className={`shrink-0 ${c.tone}`} />
                    <span className="flex-1 text-sm text-zinc-300">
                      {c.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-white">
                      £{c.pence / 100}
                    </span>
                  </motion.div>
                ))}
              </div>

              <p className="mt-6 text-[11px] leading-relaxed text-zinc-600">
                Illustrative example, not live data. Free plan takes 15%
                of request revenue; Pro takes 0%. Tips always pay out
                100% to the DJ.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
