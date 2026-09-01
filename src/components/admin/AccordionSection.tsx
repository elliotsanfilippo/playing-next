"use client";

import { ChevronDown } from "lucide-react";
import Card from "@/src/components/ui/Card";

/*
 * ── One collapsible section, used by Overview and Reports ──────────
 *
 * Both destinations answer a question whose honest form is a list of
 * headlines you can read in one screen, not several reports stacked
 * vertically. Reports measured 1724px across three sections before this,
 * which is 2.3 screens of scrolling to learn that nothing needs doing. So each section collapses to a header
 * that carries its own answer - "Growth · 13 external · 0 activated" is
 * the whole section on most visits - and opens only when you want the
 * detail behind it.
 *
 * Controlled rather than self-managing, because the accordion needs one
 * place that knows what else is open. Open state lives in the parent and
 * is not persisted: both destinations unmount when you switch away, so
 * coming back resets to the headlines rather than restoring a reading
 * position.
 *
 * Extracted from OverviewView when Reports needed the same behaviour.
 * Writing it twice is how the two drift, and this file has already been
 * bitten by one thing living in two places more than once.
 */
export default function AccordionSection({
  id,
  title,
  meta,
  metaTone = "muted",
  open,
  onToggle,
  className = "",
  children,
}: {
  id: string;
  title: string;
  meta: string;
  /** Amber when the header is reporting something that wants acting on. */
  metaTone?: "muted" | "attention";
  open: boolean;
  onToggle: (id: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="elevated" className={`overflow-hidden ${className}`}>
      {/*
        A button rather than <details>/<summary>. The open state is owned
        above, and a <details> element toggles itself on click before
        React hears about it, so the two disagree for a frame every time
        the accordion closes a different section.
      */}
      <h2>
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-expanded={open}
          aria-controls={`section-${id}`}
          className="flex min-h-[56px] w-full flex-wrap items-baseline gap-x-3 gap-y-1 p-5 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
        >
          <span className="text-h3">{title}</span>
          <span
            className={`font-mono text-xs ${
              metaTone === "attention" ? "text-status-pending" : "text-text-muted"
            }`}
          >
            {meta}
          </span>
          <ChevronDown
            size={16}
            aria-hidden
            className={`ml-auto shrink-0 self-center text-text-muted transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h2>
      <div id={`section-${id}`} hidden={!open} className="border-t border-white/5">
        {children}
      </div>
    </Card>
  );
}

