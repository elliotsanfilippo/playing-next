import type { SongRequest } from "@/src/types/dashboard";

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
  return (
    <section className="mt-8 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950">
      <div className="border-b border-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              ACTIVITY
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              Recent Activity
            </h2>

            <p className="mt-2 text-zinc-400">
              Songs you've recently played.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold transition hover:bg-white/5"
            >
              {showHistory ? "Hide Activity" : "Show Activity"}
            </button>

            {playedRequests.length > 0 && (
              <button
                onClick={clearPlayedHistory}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="p-6">
          {playedRequests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-2xl">
                🎶
              </div>

              <h3 className="text-lg font-semibold">
                Nothing here yet
              </h3>

              <p className="mt-2 text-sm text-zinc-500">
                Songs marked as played will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {playedRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-zinc-950/50 p-5 transition hover:border-white/10 hover:bg-zinc-950 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500 text-lg font-bold text-black">
                      ✓
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold">
                        {request.song_title}
                      </h3>

                      <p className="text-zinc-400">
                        {request.artist}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-full bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400">
                    Played
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}