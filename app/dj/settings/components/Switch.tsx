"use client";

import { useId } from "react";
import { cn } from "@/src/lib/cn";

/*
 * A real switch.
 *
 * What this replaces was a plain <button> reading "On" or "Off" with no
 * role and no state attribute, 36px tall — so assistive tech was told
 * nothing about it being a control with two states, and a thumb had a
 * target 8px under the minimum. State was carried by the word and the
 * fill colour alone.
 */
export default function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="flex items-start justify-between gap-4 rounded-control border border-white/10 bg-surface-base/60 p-3.5">
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="text-[13px] font-semibold text-white"
        >
          {label}
        </label>

        {description && (
          <p id={descriptionId} className="mt-1 text-xs leading-5 text-zinc-400">
            {description}
          </p>
        )}
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        /* h-11 w-[68px]: the control itself clears 44px rather than
           relying on the row around it to look big enough. */
        className={cn(
          "relative h-11 w-[68px] shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised disabled:opacity-50",
          checked
            ? "border-accent/40 bg-accent-strong"
            : "border-white/10 bg-white/5"
        )}
      >
        {/* No transition on transform: this is a control responding to a
            press, and a sliding knob on a settings toggle is decoration
            the product does not need. Colour alone carries the change,
            with the thumb position as the second channel. */}
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full transition-all",
            checked ? "left-[32px] bg-black" : "left-1 bg-zinc-500"
          )}
        />
      </button>
    </div>
  );
}
