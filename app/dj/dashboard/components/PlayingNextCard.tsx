import { useState } from "react";
import { Check, Crown } from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import Badge from "@/src/components/ui/Badge";
import Button from "@/src/components/ui/Button";

type Props = {
  currentPlayingNext: SongRequest | undefined;
  updateRequestStatus: (id: string, status: string) => Promise<void>;
};

/*
 * Hierarchy pass only.
 *
 * This card was `p-8` with a `text-4xl sm:text-6xl` title, a hardcoded
 * zinc gradient rather than surface tokens, and a 288px column showing
 * "STATUS: Ready to Play" — a panel that took a quarter of the card to
 * restate the heading. On a phone it ran to roughly 350px before the
 * DJ had seen a single pending request.
 *
 * It is still meant to be the strongest single element on the
 * dashboard, but strength here comes from the accent border, the
 * eyebrow and the type step against everything around it, not from
 * size. The richer treatment — VIP emphasis, message hierarchy, and the
 * shared-element morph up from the queue — belongs to 3C.
 */
export default function PlayingNextCard({
  currentPlayingNext,
  updateRequestStatus,
}: Props) {
  const [marking, setMarking] = useState(false);

  if (!currentPlayingNext) return null;

  const handleMarkPlayed = async () => {
    if (marking) return;

    setMarking(true);

    try {
      await updateRequestStatus(currentPlayingNext.id, "played");
    } finally {
      setMarking(false);
    }
  };

  const message =
    currentPlayingNext.request_type === "song_message" &&
    currentPlayingNext.message
      ? currentPlayingNext.message
      : null;

  return (
    <section
      aria-label="Playing next"
      className="overflow-hidden rounded-card border border-accent/25 bg-accent/[0.06]"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full bg-accent"
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Playing next
          </p>

          {currentPlayingNext.is_vip && (
            <Badge tone="warning" className="ml-1">
              <Crown size={12} /> VIP
            </Badge>
          )}
        </div>

        {/* Truncated, not wrapped: a long title must not change this
            card's height, which is what the layout below it depends on. */}
        <h2 className="mt-2.5 truncate text-2xl font-bold tracking-tight sm:text-3xl">
          {currentPlayingNext.song_title}
        </h2>

        <p className="mt-1 truncate text-sm text-zinc-400 sm:text-base">
          {currentPlayingNext.artist}
        </p>

        {message && (
          <div className="mt-3.5 rounded-control border border-white/10 bg-black/20 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Shoutout
            </p>
            <p className="mt-1.5 text-sm leading-6 text-zinc-100">
              &ldquo;{message}&rdquo;
            </p>
          </div>
        )}

        <Button
          variant="accent"
          onClick={handleMarkPlayed}
          disabled={marking}
          className="mt-4 h-12 w-full sm:h-11 sm:w-auto sm:px-6"
        >
          <Check size={16} strokeWidth={3} />
          {marking ? "Marking..." : "Mark as played"}
        </Button>
      </div>
    </section>
  );
}
