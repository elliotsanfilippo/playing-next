import { Check } from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";

type Props = {
  currentPlayingNext: SongRequest | undefined;
  updateRequestStatus: (id: string, status: string) => Promise<void>;
};

export default function PlayingNextCard({
  currentPlayingNext,
  updateRequestStatus,
}: Props) {
  if (!currentPlayingNext) return null;

  return (
    <Card
      variant="elevated"
      className="mb-8 overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950"
    >
      <div className="p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <Badge tone="accent" dot>
              NOW PLAYING NEXT
            </Badge>

            <h2 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
              {currentPlayingNext.song_title}
            </h2>

            <p className="mt-3 text-lg text-zinc-400 sm:text-xl">
              {currentPlayingNext.artist}
            </p>

            {currentPlayingNext.request_type === "song_message" &&
              currentPlayingNext.message && (
                <div className="mt-8 rounded-card border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    SHOUTOUT
                  </p>

                  <p className="mt-3 text-lg leading-relaxed text-white">
                    “{currentPlayingNext.message}”
                  </p>
                </div>
              )}
          </div>

          <div className="flex flex-col items-stretch gap-4 lg:w-72">
            <Button
              size="lg"
              onClick={() =>
                updateRequestStatus(currentPlayingNext.id, "played")
              }
            >
              <Check size={18} strokeWidth={3} /> Mark as Played
            </Button>

            <div className="rounded-card border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                STATUS
              </p>

              <p className="mt-2 text-lg font-semibold text-accent">
                Ready to Play
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
