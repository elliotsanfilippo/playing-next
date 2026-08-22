import { ACTIVITY_TIMEOUT_HOURS } from "./djActivity";

/*
 * Why requests can't be sent right now, and what to tell the guest.
 *
 * The guest page previously collapsed four unrelated situations into a
 * single red "Requests Paused" badge with no explanation and no next
 * action. Three of them come out of isEffectivelyTakingRequests(), which
 * returns one boolean for a manual pause, a scheduled close and an
 * inactivity gate; the fourth, a full pending list, is a capacity limit
 * that is not a pause at all. A guest standing in a venue needs to know
 * which of those they are looking at, because the answer to "should I
 * wait?" is different for each.
 *
 * The reasons stay distinct internally so the UI can act on them. The
 * copy deliberately does not: nothing here tells a guest that a DJ has
 * not been active, or mentions a threshold in hours. That is accurate
 * but editorialises about the DJ to their own audience, and the guest
 * cannot act on it either way. "Requests aren't available right now"
 * is equally true and costs the DJ nothing.
 */
export type AvailabilityReason =
  | "available"
  | "paused"
  | "auto_closed"
  | "unavailable"
  | "pending_full";

export type AvailabilityState = {
  reason: AvailabilityReason;
  /** Whether the guest can start or complete a request right now. */
  canRequest: boolean;
  /** Short state for the header pill. */
  label: string;
  /** One-line explanation. Null when requests are available. */
  title: string | null;
  /** What the guest can usefully do about it. */
  description: string | null;
};

type ProfileLike = {
  request_status: string;
  last_active_at: string | null;
  auto_close_at?: string | null;
};

const isPast = (value: string | null | undefined) =>
  Boolean(value && new Date(value).getTime() <= Date.now());

/*
 * Mirrors isEffectivelyTakingRequests' checks in the same order, but
 * reports which one failed rather than collapsing to a boolean. Kept
 * beside it deliberately: if that function's rules change, this must
 * change with it, and having them disagree would mean the page said one
 * thing while the submit path did another.
 */
export function availabilityReason(
  profile: ProfileLike | null,
  pendingFull: boolean
): AvailabilityReason {
  if (!profile) return "unavailable";

  if (profile.request_status !== "taking_requests") return "paused";

  if (isPast(profile.auto_close_at)) return "auto_closed";

  if (!profile.last_active_at) return "unavailable";

  const hoursSinceActive =
    (Date.now() - new Date(profile.last_active_at).getTime()) / 3_600_000;

  if (hoursSinceActive >= ACTIVITY_TIMEOUT_HOURS) return "unavailable";

  /*
   * Last, and separate from every reason above it: the DJ is live and
   * taking requests, there are simply too many already waiting for a
   * decision. This is the pending cap (max_pending_requests), not the
   * accepted queue cap (max_queue_requests) — the page used to say "this
   * DJ's queue is full", which described the wrong limit entirely and
   * implied the DJ had stopped rather than being briefly behind.
   */
  if (pendingFull) return "pending_full";

  return "available";
}

const COPY: Record<
  Exclude<AvailabilityReason, "available">,
  { label: string; title: string; description: string }
> = {
  paused: {
    label: "Requests paused",
    title: "The DJ has paused requests",
    description:
      "They're not taking new requests at the moment. Check back shortly or speak to the DJ.",
  },
  auto_closed: {
    label: "Requests closed",
    title: "Requests have closed for now",
    description:
      "The DJ set a time to stop taking requests and it's passed. Check back shortly or speak to the DJ.",
  },
  unavailable: {
    label: "Requests unavailable",
    title: "Requests aren't available right now",
    description:
      "You can't send a request to this DJ at the moment. Check back shortly or speak to the DJ.",
  },
  pending_full: {
    label: "Catching up",
    title: "The DJ has a lot of requests waiting",
    description:
      "They've got as many requests waiting for a decision as they can take right now. As soon as they work through a few, you'll be able to send yours.",
  },
};

export function availabilityState(
  profile: ProfileLike | null,
  pendingFull: boolean
): AvailabilityState {
  const reason = availabilityReason(profile, pendingFull);

  if (reason === "available") {
    return {
      reason,
      canRequest: true,
      label: "Taking requests",
      title: null,
      description: null,
    };
  }

  return { reason, canRequest: false, ...COPY[reason] };
}
