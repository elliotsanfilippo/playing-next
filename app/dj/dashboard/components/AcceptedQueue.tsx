type Props = {
  acceptedRequests: any[];
  currentPlayingNext: any;
  moveAcceptedRequest: (
    requestId: string,
    direction: "up" | "down" | "top"
  ) => Promise<void>;
  updateRequestStatus: (
    requestId: string,
    status: string
  ) => Promise<void>;
};

export default function AcceptedQueue({
  acceptedRequests,
  currentPlayingNext,
  moveAcceptedRequest,
  updateRequestStatus,
}: Props) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Accepted Queue</h2>

        <div className="rounded-full bg-green-500/20 px-4 py-2 text-sm text-green-400">
          {acceptedRequests.length}
        </div>
      </div>

      <div className="space-y-4">
        {acceptedRequests.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-center">
            <p className="font-semibold text-zinc-300">
              No accepted requests yet.
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Accepted songs will appear here.
            </p>
          </div>
        ) : (
          acceptedRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-2xl border border-white/10 bg-zinc-950 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">{request.song_title}</h3>

                  <p className="text-sm text-zinc-400">
                    {request.artist}
                  </p>

                  {request.request_type === "song_message" && (
                    <div className="mt-3 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">
                        Shoutout Message
                      </p>

                      <p className="mt-1 text-sm text-white">
                        {request.message || "No message provided"}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        moveAcceptedRequest(request.id, "top")
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold"
                    >
                      ⬆ Top
                    </button>

                    <button
                      onClick={() =>
                        moveAcceptedRequest(request.id, "up")
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold"
                    >
                      ↑ Up
                    </button>

                    <button
                      onClick={() =>
                        moveAcceptedRequest(request.id, "down")
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold"
                    >
                      ↓ Down
                    </button>
                  </div>
                </div>

                {currentPlayingNext ? (
                  <button
                    disabled
                    className="cursor-not-allowed rounded-full bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-400"
                  >
                    Waiting
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      updateRequestStatus(request.id, "playing_next")
                    }
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
                  >
                    Playing Next
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}