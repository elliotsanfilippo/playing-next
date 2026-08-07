export type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
  artwork: string | null;
};

type Props = {
  tracks: SpotifyTrack[];
  selectedSong: SpotifyTrack | null;
  isTakingRequests: boolean;
  onSelect: (track: SpotifyTrack) => void;
};

export default function TrackResults({
  tracks,
  selectedSong,
  isTakingRequests,
  onSelect,
}: Props) {
  const visibleTracks = tracks.slice(0, 8);

  if (visibleTracks.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <div className="space-y-3">
        {visibleTracks.map((track) => {
          const isSelected = selectedSong?.id === track.id;

          return (
            <button
              key={track.id}
              type="button"
              disabled={!isTakingRequests}
              onClick={() => onSelect(track)}
              className={`group w-full rounded-3xl border p-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? "border-green-500/40 bg-green-500/10 shadow-lg shadow-green-500/5"
                  : "border-white/10 bg-black/30 hover:-translate-y-0.5 hover:border-green-500/30 hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-4">
                {track.artwork ? (
                  <img
                    src={track.artwork}
                    alt={track.title}
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-xl text-zinc-600">
                    ♪
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-white">
                        {track.title}
                      </h3>

                      <p className="mt-1 truncate text-sm text-zinc-400">
                        {track.artist}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        isSelected
                          ? "border border-green-500/30 bg-green-500/15 text-green-400"
                          : "border border-white/10 bg-white/5 text-zinc-500 group-hover:text-white"
                      }`}
                    >
                      {isSelected ? "✓ Selected" : "Select"}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}