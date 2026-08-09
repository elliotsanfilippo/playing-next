import { CircleDashed, ListMusic, CheckCircle2, PoundSterling } from "lucide-react";
import StatCard from "@/src/components/ui/StatCard";

type Props = {
  pendingCount: number;
  queueCount: number;
  playedCount: number;
  tonightRevenue: number;
};

export default function StatsCards({
  pendingCount,
  queueCount,
  playedCount,
  tonightRevenue,
}: Props) {
  return (
    <section className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard
        label="Pending"
        value={pendingCount}
        icon={<CircleDashed size={20} />}
        tone="warning"
      />

      <StatCard
        label="Queue"
        value={queueCount}
        icon={<ListMusic size={20} />}
        tone="info"
      />

      <StatCard
        label="Played"
        value={playedCount}
        icon={<CheckCircle2 size={20} />}
        tone="accent"
      />

      <StatCard
        label="Tonight"
        value={`£${tonightRevenue.toFixed(2)}`}
        icon={<PoundSterling size={20} />}
        tone="accent"
      />
    </section>
  );
}
