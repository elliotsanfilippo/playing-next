import { HTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

type Variant = "flat" | "elevated";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
};

const variantClasses: Record<Variant, string> = {
  flat: "border border-white/5 bg-zinc-900/70 backdrop-blur-xl",
  elevated:
    "border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-2xl shadow-black/40 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.05),0_25px_50px_-12px_rgba(0,0,0,0.4)]",
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
