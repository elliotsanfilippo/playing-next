type Props = {
  pendingCount: number;
  queueCount: number;
  playedCount: number;
};

export default function StatsCards({
  pendingCount,
  queueCount,
  playedCount,
}: Props) {
  return (
    <>
      <div className="mb-8 mt-2 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Pending</p>
          <h2 className="mt-3 text-5xl font-bold">{pendingCount}</h2>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Queue</p>
          <h2 className="mt-3 text-5xl font-bold">{queueCount}</h2>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5">
  <p className="text-sm text-zinc-400">
    Played
  </p>

  <h2 className="mt-3 text-5xl font-bold">
    {playedCount}
  </h2>
</div>
      </div>
      {/* Paste the three stat cards here */}
    </>
  );
}