import { CircleDashed, ListMusic, CheckCircle2, PoundSterling } from "lucide-react";
import StatCard from "@/src/components/ui/StatCard";
import SizeToggle from "@/src/components/ui/SizeToggle";
import type { WidgetSize } from "@/src/lib/dashboardLayout";

type Props = {
  pendingCount: number;
  queueCount: number;
  playedCount: number;
  tonightRevenue: number;
  size: WidgetSize;
  onSizeChange: (size: WidgetSize) => void;
};

export default function StatsCards({
  pendingCount,
  queueCount,
  playedCount,
  tonightRevenue,
  size,
  onSizeChange,
}: Props) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex justify-end">
        <SizeToggle value={size} onChange={onSizeChange} />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Pending"
          value={pendingCount}
          subtitle="Awaiting review"
          icon={<CircleDashed size={20} />}
          tone="warning"
          size={size}
        />

        <StatCard
          label="Queue"
          value={queueCount}
          subtitle="Ready to play"
          icon={<ListMusic size={20} />}
          tone="info"
          size={size}
        />

        <StatCard
          label="Played"
          value={playedCount}
          subtitle="Completed"
          icon={<CheckCircle2 size={20} />}
          tone="accent"
          size={size}
        />

        <StatCard
          label="Tonight"
          value={`£${tonightRevenue.toFixed(2)}`}
          subtitle="Earned since midnight"
          icon={<PoundSterling size={20} />}
          tone="accent"
          size={size}
        />
      </div>
    </section>
  );
}
