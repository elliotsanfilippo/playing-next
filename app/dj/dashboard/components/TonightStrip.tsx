"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { Heart } from "lucide-react";

type Props = {
  pendingCount: number;
  queueCount: number;
  playedCount: number;
  tonightRevenue: number;
  tipsToday: number;
};

/*
 * Replaces the five equal stat tiles.
 *
 * Those gave the same visual weight to "Played: 11" as to what the
 * night has earned, and on a phone their 2-column grid took three rows.
 * Here earnings lead, because that is the question the dashboard should
 * answer without navigation, and the counts are one line of secondary
 * text. They stay anchor links to their sections, which is behaviour
 * the old tiles had.
 *
 * No breakdown, no chart, no trend. /dj/earnings exists for that; this
 * is a live tool and the figure is the answer, not the start of an
 * analysis.
 */
export default function TonightStrip({
  pendingCount,
  queueCount,
  playedCount,
  tonightRevenue,
  tipsToday,
}: Props) {
  const shouldReduceMotion = useReducedMotion();

  /*
   * The figure counts up only when it changes while the DJ is watching,
   * and only upward. On first paint it is simply correct — animating
   * from zero on every load would turn a fact into a performance. A
   * downward change (a refund, a decline) resolves instantly, because
   * counting money down deserves no flourish.
   */
  const [shown, setShown] = useState(tonightRevenue);
  const previous = useRef(tonightRevenue);

  useEffect(() => {
    const from = previous.current;
    previous.current = tonightRevenue;

    if (from === tonightRevenue) return;

    if (shouldReduceMotion || tonightRevenue < from) {
      setShown(tonightRevenue);
      return;
    }

    const controls = animate(from, tonightRevenue, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (value) => setShown(value),
    });

    return () => controls.stop();
  }, [tonightRevenue, shouldReduceMotion]);

  const counts = [
    { label: "pending", value: pendingCount, href: "#pending-requests" },
    { label: "queued", value: queueCount, href: "#accepted-queue" },
    { label: "played", value: playedCount, href: "#history" },
  ];

  return (
    <section
      aria-label="Tonight so far"
      className="rounded-card border border-white/10 bg-surface-raised/70 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Tonight
          </p>

          <p className="mt-1 flex items-baseline gap-2.5">
            {/* aria-live so the figure changing is announced once, with
                the settled value rather than every interpolated step. */}
            <span
              aria-live="polite"
              aria-atomic="true"
              className="text-money text-accent"
            >
              £{shown.toFixed(2)}
            </span>

            {/*
              Tips sit beside the figure, not inside it, and only when
              there are any. They are a separate revenue stream in the
              data model — the tips table has no request reference — so
              folding them into the request total, or attaching them to
              a song, would be a claim the data cannot support.
            */}
            {tipsToday > 0 && (
              <span className="flex items-center gap-1 text-sm font-semibold text-pink-300">
                <Heart size={13} className="shrink-0" />
                <span className="tabular-nums">£{tipsToday.toFixed(2)}</span>
                <span className="text-zinc-500">tips</span>
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm sm:gap-5">
          {counts.map((count) => (
            <a
              key={count.label}
              href={count.href}
              className="group flex items-baseline gap-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span className="text-base font-bold tabular-nums text-white group-hover:text-accent">
                {count.value}
              </span>
              <span className="text-zinc-500">{count.label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
