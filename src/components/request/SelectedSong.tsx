import { Music2, AlertCircle } from "lucide-react";
import type { SpotifyTrack } from "./TrackResults";
import Eyebrow from "@/src/components/ui/Eyebrow";
import Button from "@/src/components/ui/Button";

type DuplicateWarning = {
  alreadyRequested: boolean;
  alreadyPlayed: boolean;
} | null;

type Props = {
  selectedSong: SpotifyTrack;
  duplicateWarning?: DuplicateWarning;
  onChangeSong: () => void;
};

export default function SelectedSong({
  selectedSong,
  duplicateWarning,
  onChangeSong,
}: Props) {
  const warningText = duplicateWarning?.alreadyPlayed
    ? "Already played tonight — you can still request it, but it might not come round again."
    : duplicateWarning?.alreadyRequested
      ? "Someone's already requested this tonight."
      : null;

  return (
    <section className="mt-8 overflow-hidden rounded-card border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
      <div className="border-b border-white/5 px-5 py-4 sm:px-6">
        <Eyebrow tone="accent">Now requesting</Eyebrow>
      </div>

      {warningText && (
        <div className="flex items-start gap-2 border-b border-amber-400/20 bg-amber-400/10 px-5 py-3 text-sm text-amber-300 sm:px-6">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{warningText}</p>
        </div>
      )}

      <div className="flex items-center gap-4 p-5 sm:p-6">
        {selectedSong.artwork ? (
          <img
            src={selectedSong.artwork}
            alt={selectedSong.title}
            className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-lg shadow-black/30"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-zinc-600">
            <Music2 size={28} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-2xl font-bold tracking-tight text-white">
            {selectedSong.title}
          </h3>

          <p className="mt-1 truncate text-base text-zinc-400">
            {selectedSong.artist}
          </p>

          <Button
            variant="secondary"
            size="sm"
            className="mt-3 h-9 px-4"
            onClick={onChangeSong}
          >
            Change Song
          </Button>
        </div>
      </div>
    </section>
  );
}
