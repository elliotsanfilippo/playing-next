/*
 * Optional context a DJ can attach when declining. Kept to a handful of
 * one-tap options rather than free text: this gets used mid-set, on a
 * phone, in a dark booth — anything that needs typing would just get
 * skipped, and free text from a stranger is also something we'd then
 * have to moderate before showing it to a guest.
 *
 * "no_track" is the one that matters most: a guest whose song simply
 * isn't in the DJ's collection currently can't tell that apart from
 * being turned down.
 */
export type DeclineReasonKey =
  | "no_track"
  | "already_played"
  | "not_right_now"
  | "not_suitable";

type DeclineReason = {
  key: DeclineReasonKey;
  /** Shown to the DJ on the decline picker — terse, thumb-sized. */
  djLabel: string;
  /** Shown to the guest. Explains without making them feel told off. */
  guestCopy: string;
};

export const DECLINE_REASONS: DeclineReason[] = [
  {
    key: "no_track",
    djLabel: "Don’t have it",
    guestCopy: "The DJ doesn’t have this track.",
  },
  {
    key: "already_played",
    djLabel: "Already played",
    guestCopy: "This one had already been played tonight.",
  },
  {
    key: "not_right_now",
    djLabel: "Not right now",
    guestCopy: "It didn’t fit the set at that moment.",
  },
  {
    key: "not_suitable",
    djLabel: "Not suitable",
    guestCopy: "It wasn’t suitable for this event.",
  },
];

export function declineReasonGuestCopy(reason: string | null): string | null {
  if (!reason) return null;

  return (
    DECLINE_REASONS.find((option) => option.key === reason)?.guestCopy ?? null
  );
}
