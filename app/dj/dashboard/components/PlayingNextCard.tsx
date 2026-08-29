import { useState } from "react";
import { Check, Crown } from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import Badge from "@/src/components/ui/Badge";
import Button from "@/src/components/ui/Button";

type Props = {
  currentPlayingNext: SongRequest | undefined;
  updateRequestStatus: (id: string, status: string) => Promise<void>;
  /** Drives the empty copy: telling a DJ to pick from an empty queue
   *  is worse than saying nothing. */
  queueCount: number;
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
  queueCount,
}: Props) {
  const [marking, setMarking] = useState(false);

  /*
   * This used to `return null`, so there was no Playing Next surface at
   * all until something was in it — the right column simply began with
   * the Queue and the slot the DJ is meant to fill did not exist. The
   * empty state is deliberately quiet: a dashed outline and a neutral
   * fill rather than the accent treatment, because an empty slot is not
   * a live state and should not read like one.
   */
  if (!currentPlayingNext) {
    return (
      <section
        aria-label="Playing next"
        className="rounded-card border border-dashed border-white/10 px-4 py-5 sm:px-5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Playing next
        </p>

        {/*
          A state line then an explanation, matching the Needs You and
          Queue empty states. The explanation says what the slot is for
          rather than restating that it is empty, because a DJ who has
          never used it has no way to tell that this is where their
          chosen track appears.

          The two variants point at whichever step is actually next.
          Telling someone to choose from an empty queue is advice they
          cannot act on. The wording also stays distinct from the Queue
          card's "requests you accept line up here", so the two cards
          explain different jobs rather than echoing each other.
        */}
        <p className="mt-2 text-sm font-semibold text-zinc-300">
          Nothing playing next yet
        </p>

        <p className="mt-1 text-[13px] leading-5 text-text-muted">
          {queueCount > 0
            ? "Choose one from your queue and it'll be ready here when you need it."
            : "Accept a request first, then choose which one plays next."}
        </p>
      </section>
    );
  }

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
      {/* One announcement when the cued track changes, carrying the
          settled value rather than the whole card. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        Playing next: {currentPlayingNext.song_title} by{" "}
        {currentPlayingNext.artist}
      </p>

      <div className="p-3.5 sm:p-5">
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
        {/*
          A <p>, not an <h2>. This is the song currently cued, which is
          content inside the section, not a section heading — as an h2
          it ranked as a peer of "Queue" and "Needs you", so a screen
          reader's heading list read a track name as a landmark. The
          section is already named by aria-label. Type is unchanged.
        */}
        <p className="mt-2.5 truncate text-2xl font-bold tracking-tight sm:text-3xl">
          {currentPlayingNext.song_title}
        </p>

        <p className="mt-1 truncate text-sm text-zinc-400 sm:text-base">
          {currentPlayingNext.artist}
        </p>

        {message && (
          <div className="mt-3.5 rounded-control border border-white/10 bg-black/20 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Shoutout
            </p>
            {/* Clamped, like the pending card. Unbounded, one chatty
                guest turned this into a 375px hero card that took half
                a phone screen for a section meant to be glanceable. */}
            <p
              title={message}
              className="mt-1.5 line-clamp-3 text-sm leading-6 text-zinc-100"
            >
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
