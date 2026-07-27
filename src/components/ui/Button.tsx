import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export default function Button({
  variant = "primary",
  className,
  ...props
}: Props) {
  return (
    <button
      className={clsx(
        "h-12 rounded-2xl px-5 font-semibold transition-all duration-200 active:scale-95",

        {
          "bg-white text-black hover:bg-zinc-200":
            variant === "primary",

          "border border-white/10 bg-zinc-900 hover:bg-zinc-800":
            variant === "secondary",

          "bg-red-500/10 text-red-400 hover:bg-red-500/20":
            variant === "danger",
        },

        className
      )}
      {...props}
    />
  );
}