import { HTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

type Variant = "flat" | "elevated";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
};

const variantClasses: Record<Variant, string> = {
  flat: "border border-white/5 bg-zinc-900/70 backdrop-blur-xl",
  elevated:
    "border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-2xl shadow-black/30",
};

export default function Card({
  variant = "flat",
  className,
  ...props
}: Props) {
  return (
    <div
      className={cn(
        "rounded-card transition-all duration-300",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
