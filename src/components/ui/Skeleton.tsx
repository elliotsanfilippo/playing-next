import { HTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

export default function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-white/5", className)}
      {...props}
    />
  );
}
