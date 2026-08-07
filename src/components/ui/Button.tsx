import { ButtonHTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

type Variant = "primary" | "secondary" | "accent" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-white text-black shadow-lg shadow-black/20 hover:bg-zinc-200",
  secondary:
    "border border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10",
  accent:
    "bg-accent-strong text-black shadow-lg shadow-green-500/20 hover:brightness-110",
  danger:
    "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20",
  ghost: "text-zinc-300 hover:text-white",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-10 px-4 text-sm rounded-control",
  md: "h-12 px-6 text-sm rounded-control",
  lg: "h-14 px-7 text-base rounded-card",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: Props) {
  return (
    <button
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}
