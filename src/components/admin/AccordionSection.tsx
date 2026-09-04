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
  subMeta,
  metaTone = "muted",
  tone = "default",
  headingLevel = 2,
  open,
  onToggle,
  className = "",
  children,
}: {
  id: string;
  title: string;
  meta: string;
  /*
   * A second summary line, on its own row. For a standing condition that
   * belongs in the collapsed state rather than only inside the section -
   * "report only, execution disabled" is true whether or not you open it,
   * and a reader deciding whether to bother should see it first.
   */
  subMeta?: string;
  /** Amber when the header is reporting something that wants acting on. */
  metaTone?: "muted" | "attention";
  /*
   * "quiet" is for a section that is currently reporting nothing: a
   * standing fact rather than a piece of work. It keeps the same
   * control, the same count and the same disclosure, at about half the
   * height and without the elevated card behind it.
   *
   * The caller decides tone per render rather than per section, so a
   * section promotes itself the moment it has something to say. That is
   * the point: "To do · 0" leading the page in the same weight as the
   * thing the whole beta turns on teaches you to stop reading the page.
   */
  tone?: "default" | "quiet";
  /*
   * h2 by default. Inside a labelled band the band itself is the h2, so
   * the sections under it are h3 - otherwise a screen reader hears two
   * sibling h2s where the page actually has a group and its members.
   */
  headingLevel?: 2 | 3;
  open: boolean;
  onToggle: (id: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const quiet = tone === "quiet";
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <Card
      variant={quiet ? "flat" : "elevated"}
      className={`overflow-hidden ${quiet ? "border-white/5 bg-white/[0.015]" : ""} ${className}`}
    >
      {/*
        A button rather than <details>/<summary>. The open state is owned
        above, and a <details> element toggles itself on click before
        React hears about it, so the two disagree for a frame every time
        the accordion closes a different section.
      */}
      <Heading>
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-expanded={open}
          aria-controls={`section-${id}`}
          className={`flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
            quiet ? "min-h-[44px] px-4 py-2.5" : "min-h-[56px] p-5"
          }`}
        >
          <span className={quiet ? "text-sm font-semibold text-zinc-300" : "text-h3"}>
            {title}
          </span>
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
          {subMeta && (
            <span className="w-full font-mono text-xs text-text-muted">
              {subMeta}
            </span>
          )}
        </button>
      </Heading>
      <div id={`section-${id}`} hidden={!open} className="border-t border-white/5">
        {children}
      </div>
    </Card>
  );
}

