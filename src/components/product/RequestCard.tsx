"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/cn";
import { SPRING, transition } from "@/src/lib/motion";
import SongIdentity from "./SongIdentity";
import RequestRank from "./RequestRank";
import MoneyValue from "./MoneyValue";

type Props = {
  title: string;
  artist: string;
  isVip?: boolean;
  hasShoutout?: boolean;

  /** Queue position chip. Omit for non-queued contexts (pending). */
  position?: number;
  /**
   * Leading slot for contexts that have no queue position — the
   * pending list uses it for the unresolved-attention indicator.
   * Ignored when `position` is set, since they occupy the same column.
   */
  indicator?: ReactNode;
  /** Amount in pence. Omit where money isn't the point. */
  pence?: number;

  /** Badges (VIP, Paid, status) rendered top-right. */
  meta?: ReactNode;
  /** Action controls — real buttons in the product, inert in marketing. */
  actions?: ReactNode;
  /** Expanded content: a shoutout message, a decline-reason picker. */
  children?: ReactNode;

  size?: "compact" | "default";
  /** Enables Framer layout animation for reorder. Off by default so
   *  static lists don't pay for layout measurement they never use. */
  animateLayout?: boolean;
  /**
   * Visual state of the row. `accepted` keeps its green treatment
   * stable on hover — see TONE_CLASSES.
   */
  tone?: RequestTone;
  /**
   * Whether the row responds to hover. Rows are only hover-highlighted
   * where the whole row is a target; a row whose actions are buttons
   * shouldn't imply the row itself is clickable.
   */
  interactive?: boolean;
  className?: string;
};

export type RequestTone = "default" | "accepted";

/*
 * Base and hover colours are declared together per tone, never split
 * between the component and a caller's className.
 *
 * This is what caused the accepted-row hover bug: the component set
 * `hover:bg-surface-base` while the caller passed `bg-accent/[0.06]`.
 * `cn()` uses tailwind-merge, which only dedupes conflicts within the
 * same variant — a base class and a `hover:` class are different
 * variants, so both survived and hovering swapped the green accepted
 * state for the neutral surface, reading as a press.
 */
const TONE_CLASSES: Record<
  RequestTone,
  { base: string; hover: string }
> = {
  default: {
    base: "border-white/5 bg-surface-base/60",
    hover: "hover:border-white/10 hover:bg-surface-base",
  },
  accepted: {
    base: "border-status-accepted/30 bg-status-accepted/[0.06]",
    // Deliberately brightens rather than neutralises: an accepted row
    // stays unmistakably accepted whatever the pointer is doing.
    hover: "hover:border-status-accepted/45 hover:bg-status-accepted/[0.1]",
  },
};

/*
 * The shared request row.
 *
 * This is the component the whole "the website is the product" idea
 * rests on: the same card renders in the DJ's pending list and queue,
 * in the guest's own request list, and in the marketing demo — so a
 * visitor who clicks Accept on the homepage sees literally the same
 * card when they sign up.
 *
 * Deliberately presentational: no data fetching, no status mutation,
 * no knowledge of Supabase or Stripe. Everything interactive arrives
 * through `actions`, which keeps the DJ dashboard's real handlers and
 * the marketing page's inert spans on equal footing, and keeps
 * dashboard logic out of the marketing bundle.
 */
export default function RequestCard({
  title,
  artist,
  isVip = false,
  hasShoutout = false,
  position,
  indicator,
  pence,
  meta,
  actions,
  children,
  size = "default",
  animateLayout = false,
  tone = "default",
  interactive = true,
  className,
}: Props) {
  const toneClasses = TONE_CLASSES[tone];

  return (
    <motion.div
      layout={animateLayout ? "position" : false}
      transition={animateLayout ? SPRING.soft : transition.state}
      className={cn(
        "rounded-card border p-3 transition-colors",
        toneClasses.base,
        interactive && toneClasses.hover,
        className
      )}
    >
      <div className="flex items-start gap-3">
        {position !== undefined ? (
          <RequestRank
            position={position}
            size={size}
            isVip={isVip}
            className="mt-0.5"
          />
        ) : (
          indicator
        )}

        <SongIdentity
          title={title}
          artist={artist}
          size={size}
          isVip={isVip && position === undefined}
          hasShoutout={hasShoutout}
          className="flex-1"
        />

        <div className="flex shrink-0 items-center gap-2">
          {pence !== undefined && (
            <MoneyValue pence={pence} className="text-zinc-400" />
          )}
          {meta}
        </div>
      </div>

      {children}

      {actions && <div className="mt-2.5 flex gap-2 sm:mt-3">{actions}</div>}
    </motion.div>
  );
}
