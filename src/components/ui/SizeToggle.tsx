import type { WidgetSize } from "@/src/lib/dashboardLayout";
import { cn } from "@/src/lib/cn";

type Props = {
  value: WidgetSize;
  onChange: (size: WidgetSize) => void;
  className?: string;
};

const OPTIONS: { value: WidgetSize; label: string }[] = [
  { value: "compact", label: "S" },
  { value: "normal", label: "M" },
  { value: "large", label: "L" },
];

export default function SizeToggle({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-1",
        className
      )}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-label={`${option.label === "S" ? "Compact" : option.label === "M" ? "Normal" : "Large"} size`}
          aria-pressed={value === option.value}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition",
            value === option.value
              ? "bg-accent-strong text-black"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
