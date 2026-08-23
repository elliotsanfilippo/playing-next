"use client";

import { motion, useReducedMotion } from "motion/react";
import { transition } from "@/src/lib/motion";
import { hourLabel, type HourBucket } from "@/src/lib/analytics";

/*
 * When guests send requests, by the hour they sent them.
 *
 * Twenty-four bars, drawn as divs. No chart library: the whole shape of
 * the thing is one number per bar, and shipping a charting runtime to
 * draw 24 rectangles would cost more than the feature.
 *
 * This is submission time and nothing else. There is no played-at column
 * in the schema, so a "when do I play requests" chart cannot be built
 * honestly and is not attempted. The caption says so in the DJ's own
 * words rather than in a footnote.
 */
export default function HourChart({ hours }: { hours: HourBucket[] }) {
  const shouldReduceMotion = useReducedMotion();

  const max = Math.max(...hours.map((h) => h.count), 1);
  const active = hours.filter((h) => h.count > 0);

  return (
    <div className="mt-3">
      {/* The bars are decoration over data that is also given as text
          below, so they carry no semantics of their own. */}
      <div aria-hidden className="flex h-24 items-end gap-[2px]">
        {hours.map((bucket) => {
          /*
           * An hour with nothing in it is a flat 2px tick, not a bar of
           * zero height — a row of bars needs a floor to read as a row
           * rather than as the axis. It is static: there is no value to
           * grow to, and animating it would be motion for its own sake.
           */
          if (bucket.count === 0) {
            return (
              <div
                key={bucket.hour}
                title={`${hourLabel(bucket.hour)}: 0`}
                className="h-[2px] flex-1 rounded-t-[2px] bg-accent/25"
              />
            );
          }

          const isPeak = bucket.count === max;

          return (
            /*
             * scaleY from the bottom edge, not an animated height. The
             * bar is full height and scaled down to its value, which
             * keeps all 24 on the compositor: animating height would
             * run layout 24 times a frame on a phone to produce exactly
             * the same picture.
             *
             * The container is a fixed h-24 and the bars are flex-1, so
             * nothing here can move the page — the chart occupies its
             * final space from the first frame, before any bar has
             * grown into it.
             *
             * Keyed by hour, so switching range animates the same 24
             * elements from their old heights to their new ones instead
             * of dropping them and growing a fresh set from zero.
             */
            <motion.div
              key={bucket.hour}
              title={`${hourLabel(bucket.hour)}: ${bucket.count}`}
              className={`h-full flex-1 origin-bottom rounded-t-[2px] ${
                isPeak ? "bg-accent" : "bg-accent/25"
              }`}
              initial={shouldReduceMotion ? false : { scaleY: 0 }}
              animate={{ scaleY: bucket.count / max }}
              transition={shouldReduceMotion ? { duration: 0 } : transition.state}
            />
          );
        })}
      </div>

      <div
        aria-hidden
        /* zinc-400 at 10px. zinc-600 measured 2.35:1 against the card,
           which is a label you can see is there and cannot read. */
        className="mt-1.5 flex justify-between text-[10px] font-medium text-zinc-400"
      >
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>

      {/* The chart's text equivalent. Every hour that had a request,
          in order, which is the same information the bars carry. */}
      <ul className="sr-only">
        {active.map((bucket) => (
          <li key={bucket.hour}>
            {hourLabel(bucket.hour)}: {bucket.count} request
            {bucket.count === 1 ? "" : "s"}
          </li>
        ))}
      </ul>
    </div>
  );
}
