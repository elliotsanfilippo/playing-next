"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/src/lib/cn";

const fieldClasses =
  "w-full rounded-control border border-white/10 bg-black/50 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-accent/40 focus:shadow-[0_0_0_4px_rgba(74,222,128,0.08)] disabled:cursor-not-allowed disabled:opacity-40";

export function Input({
  className,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  if (type === "password") {
    return (
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          className={cn(fieldClasses, "h-14 pr-12", className)}
          {...props}
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  }

  return (
    <input type={type} className={cn(fieldClasses, "h-14", className)} {...props} />
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
