import { Music2 } from "lucide-react";
import Badge from "@/src/components/ui/Badge";

export default function DashboardPreview() {
  const queue = [
    {
      title: "Free Your Mind",
      artist: "Prospa",
      price: "£5",
    },
    {
      title: "Feel So Close",
      artist: "Calvin Harris",
      price: "£5",
    },
    {
      title: "One More Time",
      artist: "Daft Punk",
      price: "£8",
    },
  ];

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="pointer-events-none absolute inset-0 rounded-card-lg bg-green-500/15 blur-[90px]" />

      <div className="relative overflow-hidden rounded-card-lg border border-white/10 bg-[#111315]/95 p-4 shadow-2xl shadow-black/60 sm:p-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              DJ dashboard
            </p>

            <h2 className="mt-1 font-bold">Overview</h2>
          </div>

          <Badge tone="accent" dot>
            Live
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            ["Pending", "6"],
            ["Queue", "4"],
            ["Played", "23"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:p-4"
            >
              <p className="text-[11px] text-zinc-500 sm:text-xs">
                {label}
              </p>

              <p className="mt-2 text-2xl font-bold sm:text-3xl">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-accent/15 bg-accent/[0.06] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Playing next
          </p>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500">
              <Music2 size={20} className="text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">Levels</p>
              <p className="truncate text-sm text-zinc-500">
                Avicii
              </p>
            </div>

            <button
              type="button"
              className="rounded-xl bg-accent-strong px-3 py-2 text-xs font-bold text-black"
            >
              Accept
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Accepted queue</p>
            <p className="text-xs text-zinc-600">4 requests</p>
          </div>

          <div className="mt-3 space-y-2">
            {queue.map((track, index) => (
              <div
                key={track.title}
                className="flex items-center gap-3 rounded-xl bg-white/[0.025] p-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-zinc-500">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {track.title}
                  </p>

                  <p className="truncate text-xs text-zinc-600">
                    {track.artist}
                  </p>
                </div>

                <span className="text-xs text-zinc-500">
                  {track.price}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
