"use client";

import Card from "@/src/components/ui/Card";
import EventsCard, { type DjEvent } from "./EventsCard";
import QrBoxBanner from "./QrBoxBanner";

type Props = {
  events: DjEvent[];
  eventsIsPro: boolean;
  eventsError: boolean;
  onEventsChanged: () => void;
  showQrBox: boolean;
  onQrBoxDismissed: () => void;
};

/*
 * Groups the lower-urgency dashboard notices (Events Mode, the QR box
 * offer) into one shared card
 * instead of each stacking as its own full-height card — these all
 * collapse to a slim row on their own, so the win here is one
 * border/margin instead of several.
 *
 * The "not yet marked as played" reminder used to live here. It fired
 * on any non-empty queue, restated a count already shown in the Tonight
 * strip and again on the Queue card, and its action pointed at the
 * queue immediately above it. It now lives inside the queue, keyed on
 * how long a request has actually been sitting there. Chargeback disputes stay separate
 * and full-size on purpose: that one is time-sensitive and
 * money-related, not a passive notice.
 */
export default function NotificationsStrip({
  events,
  eventsIsPro,
  eventsError,
  onEventsChanged,
  showQrBox,
  onQrBoxDismissed,
}: Props) {
  return (
    <Card variant="elevated" className="overflow-hidden">
      <EventsCard
        events={events}
        isPro={eventsIsPro}
        loadFailed={eventsError}
        onChanged={onEventsChanged}
      />

      {showQrBox && (
        <>
          <div className="border-t border-white/10" />
          <QrBoxBanner onDismissed={onQrBoxDismissed} />
        </>
      )}
    </Card>
  );
}
