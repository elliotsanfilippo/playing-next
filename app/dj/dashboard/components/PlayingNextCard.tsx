import type { SongRequest } from "@/src/types/dashboard";
type Props = {
  currentPlayingNext: SongRequest | undefined;
  updateRequestStatus: (id: string, status: string) => Promise<void>;
};

export default function PlayingNextCard({
  currentPlayingNext,
  updateRequestStatus,
}: Props) {
  return (
    <>
    {currentPlayingNext && (
        <div className="mb-6 rounded-3xl border border-white/10 bg-white p-6 text-black">
          <p className="text-sm font-semibold text-zinc-500">Playing Next</p>

          <h2 className="mt-2 text-5xl font-bold">
            {currentPlayingNext.song_title}
          </h2>

          <p className="mt-1 text-zinc-600">{currentPlayingNext.artist}</p>

          {currentPlayingNext.request_type === "song_message" && (
            <div className="mt-4 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                Shoutout Message
              </p>

              <p className="mt-1 text-sm">{currentPlayingNext.message}</p>
            </div>
          )}

          <button
            onClick={() =>
              updateRequestStatus(currentPlayingNext.id, "played")
            }
            className="mt-6 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white"
          >
            Mark as Played
          </button>
        </div>
      )}
    </>
  );
}