import { ReactNode } from "react";
import { cn } from "@/src/lib/cn";
import type { WidgetSize } from "@/src/lib/dashboardLayout";

type Tone = "accent" | "danger" | "warning" | "info" | "neutral";

const paddingBySize: Record<WidgetSize, string> = {
  compact: "p-4",
  normal: "p-6",
  large: "p-7",
};

const valueTextBySize: Record<WidgetSize, string> = {
  compact: "text-2xl",
  normal: "text-4xl",
  large: "text-5xl",
};

const iconSizeBySize: Record<WidgetSize, string> = {
  compact: "h-9 w-9",
  normal: "h-12 w-12",
  large: "h-14 w-14",
};

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
  size?: WidgetSize;
};

export default function StatCard({
  label,
  value,
  subtitle,
  icon,
  tone = "neutral",
  size = "normal",
}: Props) {
  return (
    <div
      className={cn(
        "group rounded-card border border-white/5 bg-zinc-900/70 transition duration-300 hover:-translate-y-1 hover:border-white/10 hover:bg-zinc-900",
        paddingBySize[size]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <h2
            className={cn(
              "mt-3 font-bold tracking-tight",
              valueTextBySize[size]
            )}
          >
            {value}
          </h2>
          {subtitle && size !== "compact" && (
            <p className="mt-2 text-xs text-zinc-500">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-2xl",
              iconSizeBySize[size],
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
