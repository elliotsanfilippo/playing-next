import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

const fieldClasses =
  "w-full rounded-control border border-white/10 bg-black/50 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-accent/40 focus:shadow-[0_0_0_4px_rgba(74,222,128,0.08)] disabled:cursor-not-allowed disabled:opacity-40";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={cn(fieldClasses, "h-14", className)} {...props} />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(fieldClasses, "py-4", className)} {...props} />
  );
}
