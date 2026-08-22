import { HTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

type Variant = "flat" | "elevated" | "glass";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
};

/*
 * `flat` used to be `bg-zinc-900/70 backdrop-blur-xl`, and it was the
 * default, so every card in the product paid for a backdrop filter.
 *
 * backdrop-filter is not a free coat of paint. It makes the element a
 * containing block for position:fixed descendants and forces whatever
 * sits behind it to be re-sampled and re-blurred on every frame. Both
 * halves of that have already cost us real bugs: the marketing header
 * losing its fixed positioning, and the queue's reorder sheet
 * resolving `fixed` against the card instead of the viewport (measured
 * at the time: a backdrop meant to cover the screen rendering at
 * 496..865 on an 812px viewport). Paying that on the two cards that
 * re-render most often in a realtime dashboard is the worst possible
 * place to spend it.
 *
 * #131619 is surface-raised, which is what zinc-900/70 resolved to
 * over the canvas anyway, so the hierarchy is unchanged — the blur was
 * never doing visible work behind an opaque page.
 *
 * `glass` keeps the old treatment for surfaces that genuinely float
 * over something worth seeing through. Nothing in the product uses it
 * today; it exists so an atmospheric surface has a sanctioned route
 * instead of reaching for the raw utility again.
 */
const variantClasses: Record<Variant, string> = {
  flat: "border border-white/5 bg-surface-raised",
  elevated:
    "border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-2xl shadow-black/40 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.05),0_25px_50px_-12px_rgba(0,0,0,0.4)]",
  glass: "border border-white/5 bg-zinc-900/70 backdrop-blur-xl",
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
