import {
  FREE_PLATFORM_FEE_BPS,
  PRO_PLATFORM_FEE_BPS,
  SERVICE_FEE,
} from "@/src/lib/pricing";

/*
 * The rules for what a DJ may configure, in one place.
 *
 * Settings used to validate in the browser only, and wrote to
 * dj_profiles directly through the anon client — so the rules were
 * advisory. Anything that skipped the form skipped the rules, and the
 * first thing to notice a bad price was a guest's checkout failing.
 *
 * Both sides now run this same module: the page for immediate per-field
 * feedback, and /api/dj/settings as the authority. Two implementations
 * of a business rule is how they end up disagreeing.
 */

/*
 * Limits chosen against the real profile table rather than picked from
 * the air, so that no DJ who is already configured becomes invalid:
 * the longest DJ name in the database is 14 characters, the longest bio
 * 163, the largest genre list 6 entries, the longest single genre 10.
 * Every existing price and cap already sits inside these bounds.
 */
export const LIMITS = {
  /** Pence. £1 is the floor Stripe and the service fee make sensible;
   *  £50 is past any plausible request and well short of a typo. */
  requestPrice: { min: 100, max: 5_000 },
  /** Pence. Higher ceiling: a message request is the premium option. */
  messagePrice: { min: 100, max: 10_000 },
  /*
   * Both caps stop at 20. Past roughly twenty a DJ cannot read their own
   * queue mid-set, so a larger number is not a preference, it is a
   * misconfiguration that turns guests away or buries the DJ. There was
   * no upper bound at all before: the queue card already caps reorder
   * animation at 24 rows precisely because a 50+ row queue was
   * reachable.
   */
  maxPending: { min: 1, max: 20 },
  maxQueue: { min: 1, max: 20 },
  djName: { max: 40 },
  bio: { max: 500 },
  genres: { maxCount: 8, maxLength: 30 },
} as const;

export type SettingsInput = {
  djName: string;
  genres: string[];
  bio: string;
  /** Pence, both. The wire format is pence because that is how the
   *  column stores it; pounds exist only in the input box. */
  requestPrice: number;
  messagePrice: number;
  maxPending: number;
  maxQueue: number;
  /** Positive sense. The column is hidden_from_discovery, inverted once
   *  at the boundary so no UI code has to reason about a double
   *  negative. */
  showInDiscovery: boolean;
};

export type SettingsField = keyof SettingsInput;
export type FieldErrors = Partial<Record<SettingsField, string>>;

const money = (pence: number) =>
  pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;

/*
 * Pounds in the box, pence everywhere else.
 *
 * A regex rather than Number(), because Number("") is 0, Number(" ") is
 * 0 and Number("5e3") is 5000 — all of which would sail through a
 * range check as a legitimate price. Rejecting a third decimal instead
 * of rounding it away means "£5.999" gets told it is wrong rather than
 * silently becoming £6.
 */
export function poundsToPence(input: string): number | null {
  const trimmed = input.trim();

  if (!/^\d{1,6}(\.\d{1,2})?$/.test(trimmed)) return null;

  return Math.round(Number(trimmed) * 100);
}

export function penceToPounds(pence: number): string {
  return (pence / 100).toFixed(2);
}

/** Genres arrive as one comma-separated box. Empty entries and
 *  duplicates are dropped rather than reported: nobody means them. */
export function parseGenres(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of input.split(",")) {
    const genre = raw.trim().replace(/\s+/g, " ");
    if (!genre) continue;

    const key = genre.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(genre);
  }

  return out;
}

/* Used for both pence and counts: in each case a fractional or
 * non-numeric value is not a smaller mistake, it is a different kind of
 * value entirely. Also catches null, which is what the page sends when
 * its own parse of the input box failed. */
const isWholeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);

const inRange = (value: number, range: { min: number; max: number }) =>
  value >= range.min && value <= range.max;

/**
 * The authority. Takes the wire shape, returns either a clean value or
 * per-field errors — never a partially applied update, because a
 * settings save that half-lands is worse than one that fails.
 */
export function validateSettings(
  body: unknown
):
  | { ok: true; value: SettingsInput }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const input = (body ?? {}) as Record<string, unknown>;

  const djName = typeof input.djName === "string" ? input.djName.trim() : "";

  if (!djName) {
    errors.djName = "Add a DJ name so guests know whose link they scanned.";
  } else if (djName.length > LIMITS.djName.max) {
    errors.djName = `Keep this to ${LIMITS.djName.max} characters or fewer.`;
  }

  const bio = typeof input.bio === "string" ? input.bio : "";

  if (bio.length > LIMITS.bio.max) {
    errors.bio = `Keep this to ${LIMITS.bio.max} characters or fewer.`;
  }

  const genres = Array.isArray(input.genres)
    ? input.genres.filter((g): g is string => typeof g === "string")
    : [];

  if (genres.length > LIMITS.genres.maxCount) {
    errors.genres = `Pick up to ${LIMITS.genres.maxCount} genres.`;
  } else if (genres.some((g) => g.length > LIMITS.genres.maxLength)) {
    errors.genres = `Each genre needs to be ${LIMITS.genres.maxLength} characters or fewer.`;
  }

  const requestPrice = input.requestPrice;
  const messagePrice = input.messagePrice;

  if (!isWholeNumber(requestPrice) || !inRange(requestPrice, LIMITS.requestPrice)) {
    errors.requestPrice = `Set a request price between ${money(LIMITS.requestPrice.min)} and ${money(LIMITS.requestPrice.max)}.`;
  }

  if (!isWholeNumber(messagePrice) || !inRange(messagePrice, LIMITS.messagePrice)) {
    errors.messagePrice = `Set a Song + Message price between ${money(LIMITS.messagePrice.min)} and ${money(LIMITS.messagePrice.max)}.`;
  }

  /*
   * Only worth checking once both prices are individually sound —
   * otherwise a DJ clearing the price box gets told about a
   * relationship as well as about the box, and fixes the wrong one.
   */
  if (
    !errors.requestPrice &&
    !errors.messagePrice &&
    isWholeNumber(requestPrice) &&
    isWholeNumber(messagePrice) &&
    messagePrice <= requestPrice
  ) {
    errors.messagePrice =
      "Song + Message costs more than a standard request, so price it higher.";
  }

  const maxPending = input.maxPending;
  const maxQueue = input.maxQueue;

  if (!isWholeNumber(maxPending) || !inRange(maxPending, LIMITS.maxPending)) {
    errors.maxPending = `Choose between ${LIMITS.maxPending.min} and ${LIMITS.maxPending.max}.`;
  }

  if (!isWholeNumber(maxQueue) || !inRange(maxQueue, LIMITS.maxQueue)) {
    errors.maxQueue = `Choose between ${LIMITS.maxQueue.min} and ${LIMITS.maxQueue.max}.`;
  }

  if (typeof input.showInDiscovery !== "boolean") {
    errors.showInDiscovery = "Choose whether to appear in Find Your DJ.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      djName,
      bio,
      genres,
      requestPrice: requestPrice as number,
      messagePrice: messagePrice as number,
      maxPending: maxPending as number,
      maxQueue: maxQueue as number,
      showInDiscovery: input.showInDiscovery as boolean,
    },
  };
}

/*
 * What a guest actually pays, and what actually reaches the DJ.
 *
 * Worth showing because the two numbers a DJ types are neither of
 * those: the guest pays the price plus Playing Next's service fee, and
 * the DJ receives the price minus the platform fee. Computed from the
 * same constants and the same arithmetic as the checkout route, so this
 * preview cannot quote a number the real charge disagrees with.
 */
export type PricePreview = {
  guestPays: number;
  djReceives: number;
  serviceFee: number;
  platformFee: number;
};

export function previewPrice(
  pricePence: number,
  isActivePro: boolean
): PricePreview {
  const rate = isActivePro ? PRO_PLATFORM_FEE_BPS : FREE_PLATFORM_FEE_BPS;
  const platformFee = Math.round((pricePence * rate) / 10_000);

  return {
    guestPays: pricePence + SERVICE_FEE,
    djReceives: pricePence - platformFee,
    serviceFee: SERVICE_FEE,
    platformFee,
  };
}
