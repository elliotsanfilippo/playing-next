"use client";

import { ListChecks, ChevronRight } from "lucide-react";
import Card from "@/src/components/ui/Card";
import EventsCard, { type DjEvent } from "./EventsCard";
import QrBoxBanner from "./QrBoxBanner";

type Props = {
  events: DjEvent[];
  eventsIsPro: boolean;
  onEventsChanged: () => void;
  showQrBox: boolean;
  onQrBoxDismissed: () => void;
  acceptedNotPlayedCount: number;
};

/*
 * Groups the lower-urgency dashboard notices (Events Mode, the QR box
 * offer, the accepted-but-not-played reminder) into one shared card
 * instead of each stacking as its own full-height card — these all
 * collapse to a slim row on their own, so the win here is one
 * border/margin instead of several. Chargeback disputes stay separate
 * and full-size on purpose: that one is time-sensitive and
 * money-related, not a passive notice.
 */
export default function NotificationsStrip({
  events,
  eventsIsPro,
  onEventsChanged,
  showQrBox,
  onQrBoxDismissed,
  acceptedNotPlayedCount,
}: Props) {
  return (
    <Card variant="elevated" className="mb-8 overflow-hidden">
      <EventsCard events={events} isPro={eventsIsPro} onChanged={onEventsChanged} />

      {acceptedNotPlayedCount > 0 && (
        <>
          <div className="border-t border-white/10" />
          <a
            href="#accepted-queue"
            className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.03] sm:items-center"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <ListChecks size={15} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                {acceptedNotPlayedCount}{" "}
                {acceptedNotPlayedCount === 1 ? "request" : "requests"} not
                yet marked as played
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Mark tracks played as you spin them to keep your queue and
                stats accurate.
              </p>
            </div>

            <span className="flex shrink-0 items-center gap-1 self-center text-sm font-semibold text-accent">
              View queue <ChevronRight size={15} />
            </span>
          </a>
        </>
      )}

      {showQrBox && (
        <>
          <div className="border-t border-white/10" />
          <QrBoxBanner onDismissed={onQrBoxDismissed} />
        </>
      )}
    </Card>
  );
}
