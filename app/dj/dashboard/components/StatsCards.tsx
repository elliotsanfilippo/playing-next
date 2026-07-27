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
  const stats = [
    {
      title: "Pending",
      value: pendingCount,
      subtitle: "Awaiting review",
      icon: "◌",
      colour: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      title: "Queue",
      value: queueCount,
      subtitle: "Ready to play",
      icon: "≡",
      colour: "text-sky-400",
      bg: "bg-sky-500/10",
    },
    {
      title: "Played",
      value: playedCount,
      subtitle: "Completed",
      icon: "✓",
      colour: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      title: "Tonight",
      value: "—",
      subtitle: "Coming soon",
      icon: "£",
      colour: "text-white",
      bg: "bg-white/5",
    },
  ];

  return (
    <section className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="group rounded-3xl border border-white/5 bg-zinc-900/70 p-6 transition duration-300 hover:-translate-y-1 hover:border-white/10 hover:bg-zinc-900"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                {stat.title}
              </p>

              <h2 className="mt-3 text-4xl font-bold tracking-tight">
                {stat.value}
              </h2>

              <p className="mt-2 text-xs text-zinc-500">
                {stat.subtitle}
              </p>
            </div>

            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.bg}`}
            >
              <span className={`text-lg font-bold ${stat.colour}`}>
                {stat.icon}
              </span>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}