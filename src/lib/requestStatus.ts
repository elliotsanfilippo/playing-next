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


/*
 * ── Guest-facing explanations ────────────────────────────────────────
 *
 * The confirmation page used to carry its own STATUS_COPY map and My
 * Requests its own STATUS_LABEL, so three maps described the same ten
 * statuses. They had already drifted on five labels — "pending" was
 * "Waiting for DJ" here and "Pending Approval" there — and My Requests
 * was missing "refunded" and "disputed" entirely, which meant a guest
 * whose payment had been refunded saw the raw database string.
 *
 * Descriptions live here for the same reason the labels do. A page may
 * still add copy that is genuinely local to it (an action, a decline
 * reason), but what a status *means* is one answer, not three.
 *
 * Every line below is written against what the payment actually did:
 *
 *   pending      PaymentIntent authorised, NOT captured
 *   accepted     captured at accept time
 *   played       captured; the DJ marked it played
 *   declined     cancel() — authorisation released
 *   cancelled    cancel(requested_by_customer)
 *   expired      cancel(abandoned) by the expiry cron
 *   refunded     captured, then fully refunded
 *   disputed     the guest's own bank raised a chargeback
 *
 * So "pending" must never say charged, and "accepted" may.
 */
const STATUS_DESCRIPTION_GUEST: Record<string, string> = {
  checkout_pending:
    "We're confirming your payment. This usually takes a few seconds.",
  pending:
    "Your request has been sent. Your card is authorised but nothing has been taken yet — you're only charged if the DJ accepts.",
  accepted:
    "The DJ accepted your request and added it to their queue. Your payment has now been taken.",
  playing_next:
    "The DJ has lined your song up to play next.",
  /*
   * Deliberately "the DJ marked this as played" rather than "your song
   * was played". Playing Next has no way to hear a room; all we know is
   * that the DJ pressed a button, and saying more than that would be
   * claiming a verification the product does not have.
   */
  played: "The DJ marked this as played. Thanks for requesting.",
  declined:
    "The DJ couldn't take this one. Your card was never charged and the authorisation has been released.",
  cancelled:
    "You cancelled this request. Your card was never charged and the authorisation has been released.",
  expired:
    "The DJ didn't get to this one in time, so it expired. Your card was never charged.",
  /*
   * No number of days. How long a refund takes to appear is the card
   * issuer's business, not ours, and quoting "3 to 5 working days" would
   * be promising something we cannot control.
   */
  refunded:
    "This payment has been refunded. How long it takes to appear depends on your bank.",
  disputed:
    "Your bank has raised a dispute on this payment, and they'll be in touch about it.",
};

export function requestStatusDescription(status: string): string {
  return (
    STATUS_DESCRIPTION_GUEST[status] ??
    "We're checking on this request."
  );
}

/*
 * Statuses where the request is over and nothing further will happen to
 * it. Used to decide whether a page still needs live treatment, a cancel
 * action, or a "what happens next" line.
 */
const CLOSED_STATUSES = new Set([
  "declined",
  "cancelled",
  "expired",
  "refunded",
  "disputed",
]);

export function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.has(status);
}

/** Guests may only cancel while the DJ has not yet answered. Mirrors the
 *  server guard in /api/request/cancel, which rejects anything but
 *  "pending" and re-checks it in the UPDATE. */
export function canGuestCancel(status: string): boolean {
  return status === "pending";
}

/** Where a "this wasn't played" report is meaningful: the DJ took the
 *  money and said it was going in the set. Matches the server's own
 *  allowlist in /api/request/report-not-played. */
export function canReportNotPlayed(status: string): boolean {
  return ["accepted", "playing_next", "played"].includes(status);
}
