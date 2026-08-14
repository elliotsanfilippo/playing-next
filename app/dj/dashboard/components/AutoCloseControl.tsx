"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Lock } from "lucide-react";

type Props = {
  isPro: boolean;
  isTakingRequests: boolean;
  autoCloseAt: string | null | undefined;
  onSetAutoClose: (minutes: number | null) => Promise<void>;
};

const DURATION_OPTIONS = [
  { minutes: 60, label: "In 1 hour" },
  { minutes: 120, label: "In 2 hours" },
  { minutes: 240, label: "In 4 hours" },
  { minutes: 360, label: "In 6 hours" },
];

/*
 * Only shown while requests are open — scheduling a close doesn't
 * mean anything while already paused. Free DJs see a locked upsell
 * instead of the picker, matching the EventsCard pattern.
 */
export default function AutoCloseControl({
  isPro,
  isTakingRequests,
  autoCloseAt,
  onSetAutoClose,
}: Props) {
  const [pending, setPending] = useState(false);

  if (!isTakingRequests) return null;

  if (!isPro) {
    return (
      <Link
        href="/plans"
        className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
      >
        <Lock size={12} />
        Auto-close (Pro)
      </Link>
    );
  }

  if (autoCloseAt) {
    const closeTime = new Date(autoCloseAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        <Clock size={12} className="shrink-0 text-zinc-500" />
        Closes at {closeTime}
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await onSetAutoClose(null);
            } finally {
              setPending(false);
            }
          }}
          className="text-zinc-500 underline decoration-dotted underline-offset-2 transition hover:text-zinc-300 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <select
      defaultValue=""
      disabled={pending}
      onChange={async (event) => {
        const minutes = event.target.value ? Number(event.target.value) : null;
        event.target.value = "";
        setPending(true);
        try {
          await onSetAutoClose(minutes);
        } finally {
          setPending(false);
        }
      }}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-400 outline-none transition hover:text-zinc-200 disabled:opacity-50"
    >
      <option value="" disabled>
        Auto-close...
      </option>
      {DURATION_OPTIONS.map((option) => (
        <option key={option.minutes} value={option.minutes}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
