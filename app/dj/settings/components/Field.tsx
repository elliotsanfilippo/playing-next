"use client";

import { useId } from "react";
import { cn } from "@/src/lib/cn";

/*
 * A labelled field, with the label actually attached to the input.
 *
 * Every field on the old settings page was a bare <label> next to a
 * bare <input> with no htmlFor and no id: measured, 0 of 10 labels were
 * associated and 0 of 8 inputs carried a label of any kind, so the whole
 * form was unlabelled to a screen reader. Generating the id here means a
 * field cannot be added without one.
 *
 * The hint and the error are wired through aria-describedby for the same
 * reason. Errors used to be toasts, which vanish, are not associated
 * with anything, and are gone by the time someone tabs back to the field
 * they describe.
 */
export default function Field({
  label,
  hint,
  error,
  counter,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** e.g. "18 / 40". Rendered beside the label, not as a description. */
  counter?: string;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-zinc-200">
          {label}
        </label>

        {counter && (
          <span
            aria-hidden
            className={cn(
              "text-[11px] tabular-nums",
              error ? "text-status-declined" : "text-zinc-400"
            )}
          >
            {counter}
          </span>
        )}
      </div>

      {hint && (
        <p id={hintId} className="mt-1 text-xs leading-5 text-zinc-400">
          {hint}
        </p>
      )}

      <div className="mt-2">
        {children({
          id,
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        })}
      </div>

      {error && (
        <p
          id={errorId}
          /* Not a live region: the save handler announces the summary
             once, and six fields announcing themselves at the same
             moment is noise rather than help. */
          className="mt-1.5 text-xs leading-5 text-status-declined"
        >
          {error}
        </p>
      )}
    </div>
  );
}
