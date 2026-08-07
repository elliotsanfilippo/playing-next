import { Headphones, ChevronsUp, ChevronUp, ChevronDown, Play, Mic2 } from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";

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
    <Card>
      <div className="border-b border-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              UP NEXT
            </p>

            <h2 className="mt-2 text-3xl font-bold">Queue</h2>
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
          <div className="rounded-card border border-dashed border-white/10 p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-zinc-400">
              <Headphones size={24} />
            </div>

            <h3 className="text-lg font-semibold">Queue is empty</h3>

            <p className="mt-2 text-sm text-zinc-500">
              Accepted songs will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {acceptedRequests.map((request, index) => (
              <div
                key={request.id}
                className="group rounded-control border border-transparent bg-zinc-950/50 p-4 transition hover:border-white/10 hover:bg-zinc-950"
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
                          <p className="mt-2 flex items-center gap-1.5 truncate text-xs uppercase tracking-[0.2em] text-zinc-500">
                            <Mic2 size={12} /> Includes shoutout
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 px-3"
                      onClick={() => moveAcceptedRequest(request.id, "top")}
                    >
                      <ChevronsUp size={14} /> Top
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 px-3"
                      onClick={() => moveAcceptedRequest(request.id, "up")}
                    >
                      <ChevronUp size={14} /> Up
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 px-3"
                      onClick={() => moveAcceptedRequest(request.id, "down")}
                    >
                      <ChevronDown size={14} /> Down
                    </Button>

                    {currentPlayingNext ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 px-3"
                        disabled
                      >
                        Waiting
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-9 px-3"
                        onClick={() =>
                          updateRequestStatus(request.id, "playing_next")
                        }
                      >
                        <Play size={14} /> Play Next
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
