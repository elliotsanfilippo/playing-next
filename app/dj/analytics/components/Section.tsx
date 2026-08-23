"use client";

import { motion, useReducedMotion } from "motion/react";
import { transition } from "@/src/lib/motion";
import { cn } from "@/src/lib/cn";

/*
 * A section heading is a heading. A number is not.
 *
 * The page this replaced built its stat tiles out of StatCard, which
 * renders its value as an <h2> — so a screen reader's heading outline
 * for Analytics was "145", "57", "28", "39.3%", "£35.40", then "Most
 * Requested Songs". Headings here are words that describe a section,
 * and every figure is ordinary text inside one.
 */
export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("text-sm font-bold tracking-tight text-white", className)}>
      {children}
    </h2>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  /** What the number actually measures. Not decoration: most of the
   *  honesty on this page lives in these lines. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
      <SectionTitle>{title}</SectionTitle>
      {/* zinc-400, not zinc-500. These lines are where most of the
          honesty on this page lives ("not when you played them"), and
          measured against the card they sit on, zinc-500 came out at
          3.76:1 — under AA for body text. zinc-400 clears it and is
          what the earnings page already uses for explanatory copy. */}
      {hint && <p className="mt-1 text-xs leading-5 text-zinc-400">{hint}</p>}
      {children}
    </div>
  );
}

/*
 * A proportion said as a sentence with a bar beneath it, rather than a
 * percentage in a tile.
 *
 * The count is always shown; the percentage only appears once there is
 * enough behind it, which is why `percent` is nullable rather than
 * computed here. "3 requests" is true at any sample size. "60%" of five
 * requests is a number pretending to be a finding.
 */
export function Proportion({
  label,
  part,
  whole,
  percent,
}: {
  label: string;
  part: number;
  whole: number;
  percent: number | null;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="mt-3 first:mt-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-zinc-300">{label}</p>
        <p className="shrink-0 text-[13px] font-semibold tabular-nums text-white">
          {part}
          {percent !== null && (
            <span className="ml-1.5 text-zinc-500">{percent}%</span>
          )}
        </p>
      </div>

      {/* The bar repeats the count next to it, so it is decoration.
          Same scaleX gesture as the ranked lists: the track is fixed
          height and full width, so a range change eases the fill from
          its old proportion to the new one without touching layout. */}
      <div
        aria-hidden
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5"
      >
        <motion.div
          className="h-full w-full origin-left rounded-full bg-accent/60"
          initial={shouldReduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: whole > 0 ? part / whole : 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : transition.state}
        />
      </div>
    </div>
  );
}
