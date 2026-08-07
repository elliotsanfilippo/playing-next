import { HTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

export type Tone = "accent" | "danger" | "warning" | "info" | "neutral";

export const toneSurfaceClasses: Record<Tone, string> = {
  accent: "border-accent/20 bg-accent/10 text-accent",
  danger: "border-red-500/20 bg-red-500/10 text-red-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  info: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  neutral: "border-white/10 bg-white/5 text-zinc-400",
};

export const toneDotClasses: Record<Tone, string> = {
  accent: "bg-accent",
  danger: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-sky-400",
  neutral: "bg-zinc-400",
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
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
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
