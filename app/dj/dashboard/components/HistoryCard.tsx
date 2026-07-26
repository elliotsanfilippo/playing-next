type Props = {
  showHistory: boolean;
  setShowHistory: (value: boolean) => void;
  playedRequests: any[];
  clearPlayedHistory: () => Promise<void>;
};

export default function HistoryCard({
  showHistory,
  setShowHistory,
  playedRequests,
  clearPlayedHistory,
}: Props) {
  return (
    <><div className="mt-6 rounded-3xl border border-white/10 bg-zinc-900 p-5">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-sm text-zinc-400">History</p>

      <h2 className="mt-2 text-2xl font-semibold">
        {playedRequests.length} played songs
      </h2>

      <p className="mt-1 text-sm text-zinc-500">
        Songs already marked as played.
      </p>
    </div>

    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white"
      >
        {showHistory ? "Hide History" : "Show History"}
      </button>

      {playedRequests.length > 0 && (
        <button
          onClick={clearPlayedHistory}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Clear History
        </button>
      )}
    </div>
  </div>

  {showHistory && (
    <div className="mt-6 space-y-3">
      {playedRequests.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5 text-center text-zinc-400">
          No played requests yet.
        </div>
      ) : (
        playedRequests.map((request) => (
          <div
            key={request.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h3 className="font-semibold">{request.song_title}</h3>

              <p className="text-sm text-zinc-400">
                {request.artist}
              </p>
            </div>

            <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-zinc-300">
              Played
            </div>
          </div>
        ))
      )}
    </div>
  )}
</div>
    </>
  );
}