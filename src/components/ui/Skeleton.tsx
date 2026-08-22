import { HTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

export default function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      /*
       * motion-reduce:animate-none — the pulse is decorative, and it was
       * the one piece of dashboard motion with no reduced-motion path:
       * every Motion-driven animation checks useReducedMotion, but a CSS
       * keyframe animation does not go through that system.
       */
      className={cn(
        "animate-pulse rounded-control bg-white/5 motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}
