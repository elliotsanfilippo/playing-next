import type { SongRequest } from "@/src/types/dashboard";

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
    <section className="mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 shadow-2xl">
      <div className="p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-green-400">
                NOW PLAYING NEXT
              </span>
            </div>

            <h2 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
              {currentPlayingNext.song_title}
            </h2>

            <p className="mt-3 text-lg text-zinc-400 sm:text-xl">
              {currentPlayingNext.artist}
            </p>

            {currentPlayingNext.request_type === "song_message" &&
              currentPlayingNext.message && (
                <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
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
            <button
              onClick={() =>
                updateRequestStatus(currentPlayingNext.id, "played")
              }
              className="rounded-2xl bg-white px-8 py-5 text-lg font-bold text-black transition hover:scale-[1.02] hover:bg-zinc-200 active:scale-100"
            >
              ✓ Mark as Played
            </button>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                STATUS
              </p>

              <p className="mt-2 text-lg font-semibold text-green-400">
                Ready to Play
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}