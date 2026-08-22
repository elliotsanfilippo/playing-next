import { cn } from "@/src/lib/cn";

type Size = "compact" | "default";

const sizeClasses: Record<Size, string> = {
  compact: "h-7 w-7 rounded-lg text-xs",
  default: "h-12 w-12 rounded-2xl text-lg",
};

type Props = {
  /** 1-based position as shown to a human, not an array index. */
  position: number;
  size?: Size;
  isVip?: boolean;
  className?: string;
};

/*
 * The numbered chip on a queue item. VIP requests get the amber
 * treatment so a DJ can spot a paid-priority track while scanning the
 * queue peripherally, without reading the row.
 */
export default function RequestRank({
  position,
  size = "default",
  isVip = false,
  className,
}: Props) {
  return (
    /*
     * The chip announced as a naked digit, so a queue row read as
     * "3 Levels Avicii" with no indication that the 3 was a position.
     * VIP was worse: it was carried by the amber fill alone, which is
     * colour as the only channel — and the crown in SongIdentity is
     * suppressed whenever a position is present, so the queue had no
     * other VIP signal at all.
     */
    <span
      className={cn(
        "flex shrink-0 items-center justify-center font-bold tabular-nums",
        sizeClasses[size],
        isVip ? "bg-amber-400/15 text-amber-300" : "bg-white/5 text-zinc-400",
        className
      )}
      aria-label={isVip ? `VIP, position ${position}` : `Position ${position}`}
    >
      <span aria-hidden>{position}</span>
    </span>
  );
}
