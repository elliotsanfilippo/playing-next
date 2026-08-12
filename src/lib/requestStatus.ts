export type StatusTone = "accent" | "danger" | "warning" | "info" | "neutral";

const STATUS_TONE: Record<string, StatusTone> = {
  checkout_pending: "warning",
  pending: "warning",
  accepted: "accent",
  playing_next: "info",
  played: "neutral",
  declined: "danger",
  cancelled: "neutral",
  refunded: "danger",
  disputed: "danger",
};

export function requestStatusTone(status: string): StatusTone {
  return STATUS_TONE[status] ?? "warning";
}

/*
 * Casual, first-person copy for status-change notifications — distinct
 * from the more formal per-page STATUS_COPY/STATUS_LABEL objects, since
 * this is what actually gets read out in a toast or a phone's lock
 * screen, not a status card someone's already looking at.
 */
const STATUS_NOTIFICATION_COPY: Record<string, string> = {
  accepted: "Your song was accepted!",
  playing_next: "Your song is up next!",
  played: "Your song was played!",
  declined: "Your song wasn't accepted this time.",
  refunded: "Your payment was refunded.",
  disputed: "A dispute was raised on your payment.",
};

/*
 * "cancelled" is deliberately absent above: the guest cancelled it
 * themselves seconds earlier, so notifying them about it is noise.
 * Returning null here means no notification fires.
 */

export function requestStatusNotificationCopy(
  status: string
): string | null {
  return STATUS_NOTIFICATION_COPY[status] ?? null;
}
