import { useState } from "react";
import { Headphones, ChevronsUp, ChevronUp, ChevronDown, Play } from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import RequestCard from "@/src/components/product/RequestCard";

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
  const [processing, setProcessing] = useState<{
    id: string;
    action: "top" | "up" | "down" | "play";
  } | null>(null);

  const handleMove = async (
    requestId: string,
    direction: "up" | "down" | "top"
  ) => {
    if (processing) return;

    setProcessing({ id: requestId, action: direction });

    try {
      await moveAcceptedRequest(requestId, direction);
    } finally {
      setProcessing(null);
    }
  };

  const handlePlayNext = async (requestId: string) => {
    if (processing) return;

    setProcessing({ id: requestId, action: "play" });

    try {
      await updateRequestStatus(requestId, "playing_next");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-300">
          Queue
        </h2>

        <span
          className={
            acceptedRequests.length > 0
              ? "flex h-7 min-w-7 items-center justify-center rounded-full bg-status-playing-surface/15 px-2 text-sm font-bold tabular-nums text-status-playing"
              : "flex h-7 min-w-7 items-center justify-center rounded-full bg-white/5 px-2 text-sm font-bold tabular-nums text-zinc-500"
          }
        >
          {acceptedRequests.length}
        </span>
      </div>

      {/* See PendingRequests: the inner scroll container is gone. */}
      <div className="space-y-2 p-3 sm:p-4">
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
          <div>
            {acceptedRequests.map((request, index) => (
              <RequestCard
                key={request.id}
                title={request.song_title}
                artist={request.artist}
                isVip={request.is_vip}
                hasShoutout={
                  request.request_type === "song_message" &&
                  Boolean(request.message)
                }
                position={index + 1}
                animateLayout
                className="border-transparent"
                actions={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 px-3"
                      disabled={processing !== null}
                      onClick={() => handleMove(request.id, "top")}
                    >
                      <ChevronsUp size={14} />
                      {processing?.id === request.id &&
                      processing.action === "top"
                        ? "Moving..."
                        : "Top"}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 px-3"
                      disabled={processing !== null}
                      onClick={() => handleMove(request.id, "up")}
                    >
                      <ChevronUp size={14} />
                      {processing?.id === request.id &&
                      processing.action === "up"
                        ? "Moving..."
                        : "Up"}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 px-3"
                      disabled={processing !== null}
                      onClick={() => handleMove(request.id, "down")}
                    >
                      <ChevronDown size={14} />
                      {processing?.id === request.id &&
                      processing.action === "down"
                        ? "Moving..."
                        : "Down"}
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
                        disabled={processing !== null}
                        onClick={() => handlePlayNext(request.id)}
                      >
                        <Play size={14} />
                        {processing?.id === request.id &&
                        processing.action === "play"
                          ? "Starting..."
                          : "Play Next"}
                      </Button>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
