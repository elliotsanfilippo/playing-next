import type { SpotifyTrack } from "./TrackResults";

type Props = {
  selectedSong: SpotifyTrack;
  onChangeSong: () => void;
};

export default function SelectedSong({
  selectedSong,
  onChangeSong,
}: Props) {
  return (
    <section className="mt-8 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
      <div className="border-b border-white/5 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-400">
          Now requesting
        </p>
      </div>

      <div className="flex items-center gap-4 p-5 sm:p-6">
        {selectedSong.artwork ? (
          <img
            src={selectedSong.artwork}
            alt={selectedSong.title}
            className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-lg shadow-black/30"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-2xl text-zinc-600">
            ♪
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-2xl font-bold tracking-tight text-white">
            {selectedSong.title}
          </h3>

          <p className="mt-1 truncate text-base text-zinc-400">
            {selectedSong.artist}
          </p>

          <button
            type="button"
            onClick={onChangeSong}
            className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
          >
            Change Song
          </button>
        </div>
      </div>
    </section>
  );
}