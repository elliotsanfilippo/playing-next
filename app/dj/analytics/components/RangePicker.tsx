"use client";

import { RANGES, type RangeKey } from "@/src/lib/analytics";
import { cn } from "@/src/lib/cn";

/*
 * Three options, no calendar, no custom picker.
 *
 * A date picker on this page would imply Analytics can answer questions
 * about a specific night, and it cannot: there is no gig-day model yet,
 * so "last Saturday" would silently mean a browser-local calendar day
 * and cut a set in half at midnight. Rolling windows have no such edge.
 */
export default function RangePicker({
  value,
  onChange,
  disabled,
}: {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className="flex gap-1 rounded-full border border-white/10 bg-surface-raised p-1"
    >
      {RANGES.map((range) => {
        const active = range.key === value;

        return (
          <button
            key={range.key}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(range.key)}
            /* min-h-11: the button itself is the touch target, not the
               group around it. At min-h-9 the group measured 44px but
               each button was only 36px, so the thing a thumb actually
               has to hit was under size while the container looked
               compliant. */
            className={cn(
              "min-h-11 flex-1 rounded-full px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-50",
              active
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            )}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
