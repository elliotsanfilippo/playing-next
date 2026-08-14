"use client";

import Card from "@/src/components/ui/Card";
import EventsCard, { type DjEvent } from "./EventsCard";
import QrBoxBanner from "./QrBoxBanner";

type Props = {
  events: DjEvent[];
  eventsIsPro: boolean;
  onEventsChanged: () => void;
  showQrBox: boolean;
  onQrBoxDismissed: () => void;
};

/*
 * Groups the lower-urgency dashboard notices (Events Mode, the QR box
 * offer) into one shared card instead of each stacking as its own
 * full-height card — both already collapse to a slim row on their
 * own, so the win here is one border/margin instead of two. Chargeback
 * disputes stay separate and full-size on purpose: that one is
 * time-sensitive and money-related, not a passive notice.
 */
export default function NotificationsStrip({
  events,
  eventsIsPro,
  onEventsChanged,
  showQrBox,
  onQrBoxDismissed,
}: Props) {
  return (
    <Card variant="elevated" className="mb-8 overflow-hidden">
      <EventsCard events={events} isPro={eventsIsPro} onChanged={onEventsChanged} />

      {showQrBox && (
        <>
          <div className="border-t border-white/10" />
          <QrBoxBanner onDismissed={onQrBoxDismissed} />
        </>
      )}
    </Card>
  );
}
