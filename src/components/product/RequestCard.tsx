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
  className?: string;
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
  pence,
  meta,
  actions,
  children,
  size = "default",
  animateLayout = false,
  className,
}: Props) {
  return (
    <motion.div
      layout={animateLayout ? "position" : false}
      transition={animateLayout ? SPRING.soft : transition.state}
      className={cn(
        "rounded-card border border-white/5 bg-surface-base/60 p-3 transition-colors",
        "hover:border-white/10 hover:bg-surface-base",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {position !== undefined && (
          <RequestRank
            position={position}
            size={size}
            isVip={isVip}
            className="mt-0.5"
          />
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

      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </motion.div>
  );
}
