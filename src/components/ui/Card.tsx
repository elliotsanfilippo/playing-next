import { HTMLAttributes } from "react";
import clsx from "clsx";

export default function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-[32px] border border-white/5 bg-zinc-900/70 backdrop-blur-xl shadow-xl shadow-black/20 transition-all duration-300 hover:border-white/10 hover:-translate-y-1",
        className
      )}
      {...props}
    />
  );
}