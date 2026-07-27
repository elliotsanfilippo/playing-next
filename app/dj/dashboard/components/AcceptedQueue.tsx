import type { SongRequest } from "@/src/types/dashboard";

type Props = {
  acceptedRequests: SongRequest[];
  currentPlayingNext: SongRequest | undefined;
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
    <section className="rounded-[32px] border border-white/10 bg-zinc-900/70 backdrop-blur">
      <div className="border-b border-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              UP NEXT
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              Queue
            </h2>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15">
            <span className="text-xl font-bold text-sky-400">
              {acceptedRequests.length}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        {acceptedRequests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-2xl">
              🎧
            </div>

            <h3 className="text-lg font-semibold">
              Queue is empty
            </h3>

            <p className="mt-2 text-sm text-zinc-500">
              Accepted songs will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {acceptedRequests.map((request, index) => (
              <div
                key={request.id}
                className="group rounded-2xl border border-transparent bg-zinc-950/50 p-4 transition hover:border-white/10 hover:bg-zinc-950"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="flex flex-1 items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-lg font-bold text-zinc-400">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-semibold">
                        {request.song_title}
                      </h3>

                      <p className="truncate text-sm text-zinc-400">
                        {request.artist}
                      </p>

                      {request.request_type === "song_message" &&
                        request.message && (
                          <p className="mt-2 truncate text-xs uppercase tracking-[0.2em] text-zinc-500">
                            🎤 Includes shoutout
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        moveAcceptedRequest(request.id, "top")
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/5"
                    >
                      ⬆ Top
                    </button>

                    <button
                      onClick={() =>
                        moveAcceptedRequest(request.id, "up")
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/5"
                    >
                      ↑ Up
                    </button>

                    <button
                      onClick={() =>
                        moveAcceptedRequest(request.id, "down")
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/5"
                    >
                      ↓ Down
                    </button>

                    {currentPlayingNext ? (
                      <button
                        disabled
                        className="cursor-not-allowed rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-500"
                      >
                        Waiting
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          updateRequestStatus(
                            request.id,
                            "playing_next"
                          )
                        }
                        className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition hover:scale-[1.02] hover:bg-zinc-200 active:scale-100"
                      >
                        ▶ Play Next
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}