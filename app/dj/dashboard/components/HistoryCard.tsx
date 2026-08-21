import { useState } from "react";
import {Check} from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";

type Props = {
  showHistory: boolean;
  setShowHistory: (value: boolean) => void;
  playedRequests: SongRequest[];
  clearPlayedHistory: () => Promise<void>;
};

export default function HistoryCard({
  showHistory,
  setShowHistory,
  playedRequests,
  clearPlayedHistory,
}: Props) {
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (clearing) return;

    setClearing(true);

    try {
      await clearPlayedHistory();
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="border-b border-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              ACTIVITY
            </p>

            <h2 className="mt-2 text-3xl font-bold">Recent Activity</h2>

            <p className="mt-2 text-zinc-400">
              Songs you&apos;ve recently played.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "Hide Activity" : "Show Activity"}
            </Button>

            {playedRequests.length > 0 && (
              <Button onClick={handleClear} disabled={clearing}>
                {clearing ? "Clearing..." : "Clear"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="max-h-80 space-y-2 overflow-y-auto p-4">
          {playedRequests.length === 0 ? (
            /* Compact, matching Needs You and Queue. A 14x14 icon in a
               dashed box with p-10 is a marketing empty state, not one
               for a live tool. */
            <div className="px-6 py-9 text-center">
              <p className="text-sm font-semibold text-zinc-300">
                Nothing played yet
              </p>

              <p className="mt-1 text-[13px] text-zinc-600">
                Tracks you mark as played appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {playedRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 rounded-control border border-white/5 bg-zinc-950/50 p-3 transition hover:border-white/10 hover:bg-zinc-950 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-strong text-black">
                      <Check size={20} strokeWidth={3} />
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold">
                        {request.song_title}
                      </h3>

                      <p className="text-zinc-400">{request.artist}</p>
                    </div>
                  </div>

                  <Badge tone="accent">Played</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
