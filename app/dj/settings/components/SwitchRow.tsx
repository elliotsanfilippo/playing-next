"use client";

import { useId } from "react";
import { cn } from "@/src/lib/cn";

/*
 * The switch, as a row in a group rather than a bordered card of its
 * own. Same control as before — 44px, role="switch", aria-checked, a
 * real label association — restyled so a list of switches reads as one
 * list instead of three stacked panels.
 *
 * `note` exists for the one case where turning something off deserves a
 * reassurance: the copy appears only in the state that needs it, rather
 * than sitting there permanently answering a question nobody has asked
 * yet.
 */
export default function SwitchRow({
  label,
  description,
  note,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  note?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-[13px] font-medium text-white">
          {label}
        </label>

        {description && (
          <p
            id={descriptionId}
            className="mt-0.5 text-xs leading-5 text-zinc-400"
          >
            {description}
          </p>
        )}

        {note && !checked && (
          <p className="mt-1 text-xs leading-5 text-zinc-400">{note}</p>
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
        /* The control itself clears 44px rather than relying on the row
           around it to look big enough. */
        className={cn(
          "relative h-11 w-[62px] shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised disabled:opacity-50",
          checked
            ? "border-accent/40 bg-accent-strong"
            : "border-white/10 bg-white/5"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full transition-all",
            checked ? "left-[26px] bg-black" : "left-1 bg-zinc-500"
          )}
        />
      </button>
    </li>
  );
}
