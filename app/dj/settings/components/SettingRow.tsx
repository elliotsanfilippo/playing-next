"use client";

import { useEffect, useId, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/cn";

/*
 * One setting: its name, what it is currently set to, and an editor that
 * is only there when it is being changed.
 *
 * The row header is a real disclosure button carrying aria-expanded and
 * aria-controls, and the panel stays in the DOM so that relationship
 * resolves. The visible label lives in the header, so the input's own
 * label is visually hidden rather than absent — the association is the
 * point, not the second copy of the word.
 *
 * Focus moves into the field on open and back to the row on close, which
 * is what makes a disclosure usable by keyboard rather than merely
 * announced correctly.
 */
export default function SettingRow({
  label,
  value,
  hint,
  error,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  /** The resting state's answer to "what is this set to". */
  value: React.ReactNode;
  /** Shown only while editing. If a setting needs a sentence at rest,
   *  its label and value are not doing their job. */
  hint?: string;
  error?: string;
  expanded: boolean;
  onToggle: () => void;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => React.ReactNode;
}) {
  const inputId = useId();
  const panelId = `${inputId}-panel`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(expanded);

  useEffect(() => {
    if (expanded && !wasExpanded.current) {
      panelRef.current
        ?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "input, textarea"
        )
        ?.focus();
    } else if (!expanded && wasExpanded.current) {
      buttonRef.current?.focus();
    }

    wasExpanded.current = expanded;
  }, [expanded]);

  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        /* min-h-[54px]: a comfortable row rather than a bare 44px
           minimum, which is what makes a list of them feel like a
           settings screen instead of a compressed table. */
        className="flex min-h-[54px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70"
      >
        <span className="shrink-0 text-[13px] font-medium text-white">
          {label}
        </span>

        <span
          className={cn(
            "ml-auto min-w-0 truncate text-right text-[13px]",
            error ? "text-status-declined" : "text-zinc-400"
          )}
        >
          {expanded ? "" : value}
        </span>

        {/*
          A collapsed row with a problem cannot rely on its value turning
          red: that is colour as the only channel, and the error text
          itself is inside a hidden panel where a screen reader will
          never reach it. The dot is the second visual channel and the
          hidden phrase is the spoken one, so the row announces as
          "Song request, £5.00, needs attention".
        */}
        {error && !expanded && (
          <>
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-declined"
            />
            <span className="sr-only">needs attention</span>
          </>
        )}

        <ChevronRight
          size={15}
          aria-hidden
          className={cn(
            "shrink-0 text-zinc-500 transition-transform",
            expanded && "rotate-90"
          )}
        />
      </button>

      <div id={panelId} hidden={!expanded} ref={panelRef}>
        <div className="px-4 pb-4">
          <label htmlFor={inputId} className="sr-only">
            {label}
          </label>

          {children({
            id: inputId,
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : undefined,
          })}

          {hint && (
            <p id={hintId} className="mt-2 text-xs leading-5 text-zinc-400">
              {hint}
            </p>
          )}

          {error && (
            <p
              id={errorId}
              className="mt-2 text-xs leading-5 text-status-declined"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/** A row that goes somewhere or does something, rather than opening an
 *  editor. Same shape so the list stays one list. */
export function ActionRow({
  label,
  value,
  onClick,
  disabled,
}: {
  label: string;
  value?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex min-h-[54px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70 disabled:opacity-50"
      >
        <span className="shrink-0 text-[13px] font-medium text-white">
          {label}
        </span>

        <span className="ml-auto min-w-0 truncate text-right text-[13px] text-zinc-400">
          {value}
        </span>

        <ChevronRight size={15} aria-hidden className="shrink-0 text-zinc-500" />
      </button>
    </li>
  );
}

/** A row that only reports something. No affordance, because there is
 *  nothing to press. */
export function StaticRow({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <li className="px-4 py-3.5">
      <p className="text-[13px] font-medium text-white">{label}</p>
      <div className="mt-2">{children}</div>
      {note && (
        <p className="mt-2 text-xs leading-5 text-zinc-400">{note}</p>
      )}
    </li>
  );
}
