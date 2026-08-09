import { ReactNode } from "react";
import { cn } from "@/src/lib/cn";

type Tone = "accent" | "danger" | "warning" | "info" | "neutral";

const iconBg: Record<Tone, string> = {
  accent: "bg-accent/10",
  danger: "bg-red-500/10",
  warning: "bg-amber-500/10",
  info: "bg-sky-500/10",
  neutral: "bg-white/5",
};

const iconColor: Record<Tone, string> = {
  accent: "text-accent",
  danger: "text-red-400",
  warning: "text-amber-400",
  info: "text-sky-400",
  neutral: "text-white",
};

type Props = {
  label: string;
  value: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  tone?: Tone;
};

export default function StatCard({
  label,
  value,
  subtitle,
  icon,
  tone = "neutral",
}: Props) {
  return (
    <div className="group rounded-card border border-white/5 bg-zinc-900/70 p-4 transition duration-300 hover:-translate-y-1 hover:border-white/10 hover:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">{value}</h2>
          {subtitle && <p className="mt-2 text-xs text-zinc-500">{subtitle}</p>}
        </div>

        {icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
              iconBg[tone]
            )}
          >
            <span className={cn("text-lg font-bold", iconColor[tone])}>
              {icon}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
