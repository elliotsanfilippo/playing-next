import { HTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

type Tone = "accent" | "neutral";

const toneClasses: Record<Tone, string> = {
  accent: "text-accent",
  neutral: "text-zinc-500",
};

type Props = HTMLAttributes<HTMLParagraphElement> & {
  tone?: Tone;
};

export default function Eyebrow({
  tone = "neutral",
  className,
  ...props
}: Props) {
  return (
    <p
      className={cn("text-eyebrow", toneClasses[tone], className)}
      {...props}
    />
  );
}
