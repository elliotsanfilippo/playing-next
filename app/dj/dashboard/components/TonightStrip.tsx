import { Heart } from "lucide-react";

type Props = {
  pendingCount: number;
  queueCount: number;
  playedCount: number;
  tonightRevenue: number;
  tipsToday: number;
};

/*
 * Replaces the five equal stat tiles.
 *
 * Those gave the same visual weight to "Played: 11" as to what the
 * night has earned, and on a phone their 2-column grid took three rows
 * — roughly 330px of the ~1000px of chrome that used to sit between the
 * top of the page and the first pending request.
 *
 * Here earnings lead, because that is the question the dashboard should
 * answer without navigation, and the counts become a single line of
 * secondary text. They stay anchor links to their sections, which is
 * behaviour the old tiles had and DJs may rely on.
 *
 * Deliberately no count-up animation yet — that belongs with the
 * earnings work in 3D, not with the hierarchy pass.
 */
export default function TonightStrip({
  pendingCount,
  queueCount,
  playedCount,
  tonightRevenue,
  tipsToday,
}: Props) {
  const counts = [
    { label: "pending", value: pendingCount, href: "#pending-requests" },
    { label: "queued", value: queueCount, href: "#accepted-queue" },
    { label: "played", value: playedCount, href: "#history" },
  ];

  return (
    <section
      aria-label="Tonight so far"
      className="rounded-card border border-white/10 bg-surface-raised/70 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Tonight
          </p>

          <p className="mt-1 flex items-baseline gap-2.5">
            <span className="text-money text-accent">
              £{tonightRevenue.toFixed(2)}
            </span>

            {tipsToday > 0 && (
              <span className="flex items-center gap-1 text-sm font-semibold text-pink-300">
                <Heart size={13} className="shrink-0" />
                <span className="tabular-nums">
                  £{tipsToday.toFixed(2)}
                </span>
                <span className="text-zinc-500">tips</span>
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm sm:gap-5">
          {counts.map((count) => (
            <a
              key={count.label}
              href={count.href}
              className="group flex items-baseline gap-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span className="text-base font-bold tabular-nums text-white group-hover:text-accent">
                {count.value}
              </span>
              <span className="text-zinc-500">{count.label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
