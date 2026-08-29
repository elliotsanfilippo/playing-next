import { useState } from "react";
import {Check} from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import Card from "@/src/components/ui/Card";
import ScrollList from "@/src/components/ui/ScrollList";
import Button from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";

type Props = {
  showHistory: boolean;
  setShowHistory: (value: boolean) => void;
  /** Already filtered to what the DJ has not cleared. */
  playedRequests: SongRequest[];
  /** How many played requests a previous clear is hiding. */
  clearedCount: number;
  clearPlayedHistory: () => Promise<void>;
};

export default function HistoryCard({
  showHistory,
  setShowHistory,
  playedRequests,
  clearedCount,
  clearPlayedHistory,
}: Props) {
  const [clearing, setClearing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleClear = async () => {
    if (clearing) return;

    setClearing(true);

    try {
      await clearPlayedHistory();
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  };

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="border-b border-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
              ACTIVITY
            </p>

            <h2 className="mt-2 text-3xl font-bold">Recent Activity</h2>

            <p className="mt-2 text-zinc-400">
              Songs you&apos;ve recently played.
            </p>
          </div>

          {/*
           * Clear was the primary white button, which gave the only
           * action here that a DJ cannot walk back the most visual
           * weight, sitting above the ordinary Show/Hide toggle. It is
           * now the danger variant, and it asks first, matching how
           * QrBoxBanner handles its own final choice.
           *
           * Worth being precise in the copy: this sets dj_hidden on the
           * played requests rather than deleting them, so earnings and
           * totals are genuinely untouched. That claim is now load
           * bearing and true: as of 5A.1 nothing outside this list
           * reads the flag, and Tonight's earnings and played count are
           * both derived from the unfiltered dataset. There is no
           * unhide anywhere in the product though, so for the DJ it
           * really is one-way.
           */}
          {confirming ? (
            <div className="flex flex-col gap-3 lg:items-end">
              <p className="text-sm text-zinc-300">
                Clear your activity list? You can&apos;t undo this. Your
                earnings and totals stay exactly as they are.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setConfirming(false)}
                  disabled={clearing}
                >
                  Cancel
                </Button>

                <Button
                  variant="danger"
                  onClick={handleClear}
                  disabled={clearing}
                >
                  {clearing ? "Clearing..." : "Yes, clear"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? "Hide Activity" : "Show Activity"}
              </Button>

              {playedRequests.length > 0 && (
                <Button
                  variant="danger"
                  /* "Clear" alone is ambiguous read out of context by a
                     screen reader, and this is the control that hides a
                     night's activity list. */
                  aria-label="Clear played history"
                  onClick={() => setConfirming(true)}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {showHistory && (
        <ScrollList className="space-y-2 p-4">
          {playedRequests.length === 0 ? (
            /* Compact, matching Needs You and Queue. A 14x14 icon in a
               dashed box with p-10 is a marketing empty state, not one
               for a live tool.

               Two empty states rather than one. An empty list after a
               clear is not the same fact as an empty list before
               anything has played, and now that Tonight keeps counting
               played tracks the DJ can see "3 played" above a list
               saying "Nothing played yet". This says which one it is. */
            <div className="px-6 py-9 text-center">
              {clearedCount > 0 ? (
                <>
                  <p className="text-sm font-semibold text-zinc-300">
                    Activity cleared
                  </p>

                  <p className="mt-1 text-[13px] text-zinc-600">
                    Your tonight totals and earnings are unchanged.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-zinc-300">
                    Nothing played yet
                  </p>

                  <p className="mt-1 text-[13px] text-zinc-600">
                    Tracks you mark as played appear here.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {playedRequests.map((request) => (
                /*
                 * One row at every width. This was flex-col until lg, so on
                 * a phone the Badge became a stretched full-width block on
                 * its own line, which read as a bar rather than a status
                 * chip, and each played track cost roughly twice the height
                 * it needed in what is secondary content.
                 */
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-3 rounded-control border border-white/5 bg-zinc-950/50 p-3 transition hover:border-white/10 hover:bg-zinc-950 sm:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-strong text-black sm:h-12 sm:w-12">
                      <Check size={20} strokeWidth={3} />
                    </div>

                    <div className="min-w-0">
                      <h3
                        className="truncate text-base font-semibold sm:text-lg"
                        title={request.song_title}
                      >
                        {request.song_title}
                      </h3>

                      <p className="truncate text-sm text-zinc-400 sm:text-base">
                        {request.artist}
                      </p>
                    </div>
                  </div>

                  <Badge tone="accent" className="shrink-0">
                    Played
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ScrollList>
      )}
    </Card>
  );
}
