import { cn } from "@/src/lib/cn";

type Size = "inline" | "prominent" | "hero";

const sizeClasses: Record<Size, string> = {
  /** Sits inside a row next to other text — a queue item's price. */
  inline: "text-sm",
  /** Its own element — a stat tile, a request's amount. */
  prominent: "text-xl",
  /** The money moment: earnings totals, marketing reveals. */
  hero: "text-money",
};

type Props = {
  /** Amount in pence, matching how the database stores every value. */
  pence: number;
  size?: Size;
  /** Hide pennies on whole amounts: £5 rather than £5.00. */
  compact?: boolean;
  className?: string;
};

/*
 * Single formatter for every monetary value in the product. Everything
 * upstream (dj_earnings, request_amount, disputed_amount, tips) is
 * stored in pence, and this is the only place that converts — passing
 * pounds in by mistake is the classic 100x bug, hence the explicit
 * `pence` prop name rather than a bare `amount`.
 *
 * tabular-nums matters more than it looks: without it, an animated
 * counter ticking 79 -> 80 -> 81 visibly jitters as glyph widths
 * change. Money should feel solid.
 */
export default function MoneyValue({
  pence,
  size = "inline",
  compact = true,
  className,
}: Props) {
  const pounds = pence / 100;
  const isWhole = pence % 100 === 0;
  const formatted =
    compact && isWhole ? `£${pounds}` : `£${pounds.toFixed(2)}`;

  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        sizeClasses[size],
        className
      )}
    >
      {formatted}
    </span>
  );
}
