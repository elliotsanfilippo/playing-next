import { PauseCircle, Clock, Inbox, CalendarX } from "lucide-react";
import type { AvailabilityState } from "@/src/lib/guestAvailability";

const ICONS = {
  paused: PauseCircle,
  auto_closed: CalendarX,
  unavailable: Clock,
  pending_full: Inbox,
  available: Clock,
} as const;

/*
 * Why the guest can't send a request, in place of the search field.
 *
 * Replaces a bare red "Requests Paused" badge that said nothing about
 * what had happened or what to do next. A full pending list is treated
 * as amber rather than red: the DJ is live and working through a
 * backlog, so it is a wait, not a closed door — the same semantic
 * distinction the dashboard makes between an unresolved request and a
 * reminder.
 */
export default function UnavailableNotice({
  availability,
}: {
  availability: AvailabilityState;
}) {
  if (availability.canRequest) return null;

  const Icon = ICONS[availability.reason];
  const waiting = availability.reason === "pending_full";

  return (
    <div
      role="status"
      className={
        waiting
          ? "flex items-start gap-3 rounded-card border border-status-pending-surface/25 bg-status-pending-surface/[0.07] p-4"
          : "flex items-start gap-3 rounded-card border border-status-declined/25 bg-status-declined/[0.07] p-4"
      }
    >
      <Icon
        size={18}
        aria-hidden
        className={
          waiting
            ? "mt-0.5 shrink-0 text-status-pending"
            : "mt-0.5 shrink-0 text-status-declined"
        }
      />

      <div className="min-w-0">
        <p
          className={
            waiting
              ? "text-sm font-semibold text-status-pending"
              : "text-sm font-semibold text-status-declined"
          }
        >
          {availability.title}
        </p>

        <p className="mt-1 text-[13px] leading-5 text-zinc-400">
          {availability.description}
        </p>
      </div>
    </div>
  );
}
