import { Crown, Mic2 } from "lucide-react";
import { cn } from "@/src/lib/cn";

type Size = "compact" | "default" | "feature";

const titleClasses: Record<Size, string> = {
  compact: "text-sm font-semibold",
  default: "text-lg font-semibold",
  feature: "text-4xl font-black tracking-tight sm:text-6xl",
};

const artistClasses: Record<Size, string> = {
  compact: "text-xs text-zinc-500",
  default: "text-sm text-zinc-400",
  feature: "mt-3 text-lg text-zinc-400 sm:text-xl",
};

type Props = {
  title: string;
  artist: string;
  size?: Size;
  isVip?: boolean;
  /** Shows a "includes shoutout" affordance without the message body. */
  hasShoutout?: boolean;
  className?: string;
};

/*
 * A song's identity — the title/artist pair that appears in every
 * request surface: the DJ's pending list and queue, the guest's own
 * request list, the venue display screen, and the marketing demo.
 *
 * Always truncates rather than wrapping. Real track titles are long
 * ("Don't You Worry Child - Radio Edit"), and a wrapping title
 * silently changes a queue row's height, which breaks the layout
 * animation when rows reorder. min-w-0 on the wrapper is what actually
 * makes truncate work inside a flex row.
 */
export default function SongIdentity({
  title,
  artist,
  size = "default",
  isVip = false,
  hasShoutout = false,
  className,
}: Props) {
  return (
    <div className={cn("min-w-0", className)}>
      {/*
        The title text needs its own element inside the flex row.
        `truncate` on the <h3> itself set overflow:hidden and
        text-overflow:ellipsis on a flex *container*, where the text
        becomes an anonymous flex item that ellipsis cannot render on —
        so long titles were clipped mid-word with no visual indication
        that anything had been cut. The span is a real flex item, and
        min-w-0 is what lets it shrink below its content so the ellipsis
        has somewhere to go.
      */}
      <h3 className={cn("flex items-center gap-2", titleClasses[size])}>
        {isVip && (
          <>
            {/* aria-label on a bare <svg> is not reliably announced
                without role="img". A visually hidden word is. */}
            <Crown
              size={size === "compact" ? 12 : 16}
              className="shrink-0 text-amber-400"
              aria-hidden
            />
            <span className="sr-only">VIP request</span>
          </>
        )}
        <span className="min-w-0 truncate">{title}</span>
      </h3>

      <p className={cn("truncate", artistClasses[size])}>{artist}</p>

      {/* Deliberately quiet. This was uppercase with 0.2em tracking on
          its own line, which made a secondary attribute the widest and
          loudest thing in a queue row. */}
      {hasShoutout && (
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-zinc-500">
          <Mic2 size={11} className="shrink-0" aria-hidden /> Shoutout
        </p>
      )}
    </div>
  );
}
