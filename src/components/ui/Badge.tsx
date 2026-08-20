import { HTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

export type Tone = "accent" | "danger" | "warning" | "info" | "neutral";

/*
 * Tones resolve to the semantic status tokens in globals.css rather
 * than raw palette colours. `requestStatusTone()` maps a request's
 * status onto one of these, so changing what "pending" looks like is a
 * one-line token edit that lands everywhere at once — DJ dashboard,
 * guest pages, venue display and the marketing demo.
 *
 * Tones stay generically named because Badge is also used for
 * non-status labels (VIP, Paid, Live); the status meaning lives in the
 * token, not the tone name.
 */
export const toneSurfaceClasses: Record<Tone, string> = {
  accent:
    "border-status-accepted-surface/20 bg-status-accepted-surface/10 text-status-accepted",
  danger:
    "border-status-declined-surface/20 bg-status-declined-surface/10 text-status-declined",
  warning:
    "border-status-pending-surface/20 bg-status-pending-surface/10 text-status-pending",
  info: "border-status-playing-surface/20 bg-status-playing-surface/10 text-status-playing",
  neutral: "border-white/10 bg-white/5 text-status-played",
};

export const toneDotClasses: Record<Tone, string> = {
  accent: "bg-status-accepted",
  danger: "bg-status-declined",
  warning: "bg-status-pending-dot",
  info: "bg-status-playing-dot",
  neutral: "bg-status-played",
};

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  dot?: boolean;
};

export default function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: Props) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold",
        toneSurfaceClasses[tone],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("h-2 w-2 rounded-full", toneDotClasses[tone])} />
      )}
      {children}
    </span>
  );
}
