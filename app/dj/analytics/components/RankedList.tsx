"use client";

import { motion, useReducedMotion } from "motion/react";
import { staggerContainer, transition } from "@/src/lib/motion";
import { cn } from "@/src/lib/cn";

export type RankedItem = {
  key: string;
  title: string;
  subtitle?: string | null;
  count: number;
};

/** Lead-in between bars. Two frames apart, not a wave: at five rows the
 *  whole list is in within 0.16s of the first bar starting. */
const STAGGER = 0.04;

/*
 * A ranked list with the bar drawn behind the row rather than beside it.
 *
 * A separate bar column would cost horizontal space this page does not
 * have at 320px, and the comparison being made here is coarse — is the
 * top track miles ahead, or is everything level. A tinted backing does
 * that at a glance and lets the text keep the full width.
 *
 * The bar is aria-hidden. The number is already in the row, so a screen
 * reader reading a percentage of a bar width would be repeating the
 * count in a less useful form.
 */
export default function RankedList({
  items,
  unit,
  className,
}: {
  items: RankedItem[];
  /** Singular noun for the count, e.g. "request". */
  unit: string;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    /*
     * The stagger is orchestration, not a per-item delay.
     *
     * staggerChildren applies when this container animates into
     * "visible", which happens once, on mount. After that the container
     * stays put, so a range switch changes each bar's resolved variant
     * value and the bars animate straight to it with no lead-in — the
     * reveal is a first impression and is spent once, rather than
     * replaying every time a filter is pressed.
     *
     * Doing it this way also keeps the decision out of render. The
     * earlier attempt tracked "have we mounted yet" in a ref and read it
     * while rendering, which is exactly the pattern React cannot
     * guarantee under concurrent rendering.
     */
    <motion.ol
      className={cn("space-y-1.5", className)}
      variants={staggerContainer(STAGGER)}
      initial={shouldReduceMotion ? false : "hidden"}
      animate="visible"
    >
      {items.map((item, index) => (
        <li
          key={item.key}
          className="relative overflow-hidden rounded-control border border-white/5 bg-surface-base/60"
        >
          {/*
            scaleX on a full-width element rather than an animated width.
            Transform is composited, so twenty-odd bars growing at once
            never touch layout — animating `width` would put every frame
            through layout on a phone for no visual difference.

            It also makes the two cases one animation. A track that
            appears in both the old range and the new one keeps its
            element, so its bar eases from the old proportion to the new
            one; a track that is new to this range mounts and grows from
            nothing. Neither needs special handling.
          */}
          <motion.div
            aria-hidden
            className="absolute inset-y-0 left-0 w-full origin-left bg-accent/10"
            variants={{
              hidden: { scaleX: 0 },
              visible: {
                scaleX: item.count / max,
                transition: shouldReduceMotion
                  ? { duration: 0 }
                  : transition.state,
              },
            }}
          />

          <div className="relative flex items-center gap-3 p-2.5">
            <span
              aria-hidden
              className="w-4 shrink-0 text-center text-xs font-bold tabular-nums text-zinc-400"
            >
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">
                {item.title}
              </p>
              {item.subtitle && (
                <p className="truncate text-xs text-zinc-400">
                  {item.subtitle}
                </p>
              )}
            </div>

            {/* Not animated. The bar is the gesture; a number ticking up
                beside it would be two things saying the same thing, and
                a count is read, not watched. */}
            <span className="shrink-0 text-[13px] font-bold tabular-nums text-zinc-300">
              {item.count}
              <span className="sr-only">
                {" "}
                {unit}
                {item.count === 1 ? "" : "s"}
              </span>
            </span>
          </div>
        </li>
      ))}
    </motion.ol>
  );
}
