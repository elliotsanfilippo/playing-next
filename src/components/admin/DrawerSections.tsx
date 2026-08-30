"use client";

import { ChevronDown } from "lucide-react";

/*
 * Progressive disclosure using <details>, not React state: it is
 * keyboard operable and screen-reader announced for free, it survives
 * re-render, and the browser handles the open/closed semantics without
 * an aria-expanded of our own to keep in sync.
 */
export function MoreDetails({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-t border-white/5 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40">
        {title}
        <ChevronDown
          size={16}
          className="shrink-0 text-text-muted transition group-open:rotate-180"
        />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-text-muted">
      {children}
    </p>
  );
}
