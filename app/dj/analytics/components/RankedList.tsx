import { cn } from "@/src/lib/cn";

export type RankedItem = {
  key: string;
  title: string;
  subtitle?: string | null;
  count: number;
};

/*
 * A ranked list with the bar drawn behind the row rather than beside it.
 *
 * A separate bar column would cost horizontal space this page does not
 * have at 320px, and the comparison being made here is coarse — is the
 * top track miles ahead, or is everything level. A tinted backing does
 * that at a glance and lets the text keep the full width.
 *
 * The bar is aria-hidden. The number is already in the row, so a screen
 * reader reading a percentage of a bar width would be repeating the
 * count in a less useful form.
 */
export default function RankedList({
  items,
  unit,
  className,
}: {
  items: RankedItem[];
  /** Singular noun for the count, e.g. "request". */
  unit: string;
  className?: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <ol className={cn("space-y-1.5", className)}>
      {items.map((item, index) => (
        <li
          key={item.key}
          className="relative overflow-hidden rounded-control border border-white/5 bg-surface-base/60"
        >
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 bg-accent/10"
            style={{ width: `${(item.count / max) * 100}%` }}
          />

          <div className="relative flex items-center gap-3 p-2.5">
            <span
              aria-hidden
              className="w-4 shrink-0 text-center text-xs font-bold tabular-nums text-zinc-400"
            >
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">
                {item.title}
              </p>
              {item.subtitle && (
                <p className="truncate text-xs text-zinc-400">
                  {item.subtitle}
                </p>
              )}
            </div>

            <span className="shrink-0 text-[13px] font-bold tabular-nums text-zinc-300">
              {item.count}
              <span className="sr-only">
                {" "}
                {unit}
                {item.count === 1 ? "" : "s"}
              </span>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
