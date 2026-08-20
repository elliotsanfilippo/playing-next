export type StatusTone = "accent" | "danger" | "warning" | "info" | "neutral";

const STATUS_TONE: Record<string, StatusTone> = {
  checkout_pending: "warning",
  pending: "warning",
  accepted: "accent",
  playing_next: "info",
  played: "neutral",
  declined: "danger",
  cancelled: "neutral",
  expired: "neutral",
  refunded: "danger",
  disputed: "danger",
};

export function requestStatusTone(status: string): StatusTone {
  return STATUS_TONE[status] ?? "warning";
}

/*
 * Canonical short labels for a request's state.
 *
 * Deliberately audience-split: a DJ sees their own queue ("Pending",
 * "In Queue"), while a guest sees their one request from the outside
 * ("Waiting for DJ", "In Queue"). Same underlying status, different
 * framing — collapsing them into one map is what causes a DJ's
 * dashboard to say "Waiting for DJ" about their own inbox.
 *
 * Pages that need a longer explanatory sentence (the guest
 * confirmation page) keep their own description copy, but should take
 * the label from here so the two never drift apart.
 */
const STATUS_LABEL_DJ: Record<string, string> = {
  checkout_pending: "Confirming",
  pending: "Pending",
  accepted: "In Queue",
  playing_next: "Playing Next",
  played: "Played",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
  refunded: "Refunded",
  disputed: "Disputed",
};

const STATUS_LABEL_GUEST: Record<string, string> = {
  checkout_pending: "Confirming Payment",
  pending: "Waiting for DJ",
  accepted: "In Queue",
  playing_next: "Playing Next",
  played: "Played",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
  refunded: "Refunded",
  disputed: "Payment Disputed",
};

export type StatusAudience = "dj" | "guest";

export function requestStatusLabel(
  status: string,
  audience: StatusAudience = "dj"
): string {
  const map = audience === "guest" ? STATUS_LABEL_GUEST : STATUS_LABEL_DJ;
  return map[status] ?? status;
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
  expired: "Your request expired. You weren't charged.",
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
