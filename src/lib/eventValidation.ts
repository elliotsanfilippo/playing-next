import {
  LIMITS,
  type FieldErrors as SettingsFieldErrors,
} from "@/src/lib/settingsValidation";

/*
 * What a DJ may configure on an event.
 *
 * Deliberately built on the Settings limits rather than beside them.
 * Events used to accept any integer above zero, so an event could be
 * created charging £0.01, or £10,000, or — the one that actually
 * matters — Song + Message priced *below* a standard request, which
 * Settings has always forbidden. A guest would have paid less for the
 * strictly larger product.
 *
 * The table is empty, so aligning the two costs nothing today and
 * becomes impossible to do cleanly the moment a real event exists.
 */

export type EventField = "name" | "requestPrice" | "messagePrice";
export type EventFieldErrors = Partial<Record<EventField, string>>;

export type EventInput = {
  name: string;
  /** Pence, or null meaning "use my default". */
  requestPrice: number | null;
  messagePrice: number | null;
};

const money = (pence: number) =>
  pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;

const isWholeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);

/** null is a real answer here, not a missing one: it means inherit. */
const optionalPence = (value: unknown): "absent" | "invalid" | number => {
  if (value === null || value === undefined) return "absent";
  if (!isWholeNumber(value)) return "invalid";
  return value;
};

/**
 * Validates an event against the DJ's own defaults, because the rule
 * that Song + Message costs more than a standard request is about what
 * a guest is actually charged, not about which fields happen to be
 * filled in.
 *
 * An event overriding only the request price to £10 while inheriting a
 * £8 default message price would break that rule with both fields
 * individually valid, so the comparison is made on the effective prices
 * rather than on the submitted ones.
 */
export function validateEvent(
  body: unknown,
  defaults: { requestPrice: number; messagePrice: number }
):
  | { ok: true; value: EventInput }
  | { ok: false; errors: EventFieldErrors } {
  const errors: EventFieldErrors = {};
  const input = (body ?? {}) as Record<string, unknown>;

  const name = typeof input.name === "string" ? input.name.trim() : "";

  if (!name) {
    errors.name = "Give this event a name so you can find it later.";
  } else if (name.length > LIMITS.eventName.max) {
    /* Rejected, not silently truncated. The old route sliced to 100
     * characters, so a DJ's name came back shortened with no
     * explanation and no way to tell that it had happened. */
    errors.name = `Keep this to ${LIMITS.eventName.max} characters or fewer.`;
  }

  const requestPrice = optionalPence(input.requestPrice);
  const messagePrice = optionalPence(input.messagePrice);

  if (
    requestPrice === "invalid" ||
    (typeof requestPrice === "number" &&
      (requestPrice < LIMITS.requestPrice.min ||
        requestPrice > LIMITS.requestPrice.max))
  ) {
    errors.requestPrice = `Set a request price between ${money(LIMITS.requestPrice.min)} and ${money(LIMITS.requestPrice.max)}, or leave it blank to use your default.`;
  }

  if (
    messagePrice === "invalid" ||
    (typeof messagePrice === "number" &&
      (messagePrice < LIMITS.messagePrice.min ||
        messagePrice > LIMITS.messagePrice.max))
  ) {
    errors.messagePrice = `Set a Song + Message price between ${money(LIMITS.messagePrice.min)} and ${money(LIMITS.messagePrice.max)}, or leave it blank to use your default.`;
  }

  if (!errors.requestPrice && !errors.messagePrice) {
    const effectiveRequest =
      typeof requestPrice === "number" ? requestPrice : defaults.requestPrice;
    const effectiveMessage =
      typeof messagePrice === "number" ? messagePrice : defaults.messagePrice;

    if (effectiveMessage <= effectiveRequest) {
      errors.messagePrice =
        typeof messagePrice === "number"
          ? "Song + Message costs more than a standard request, so price it higher."
          : `Your default Song + Message price (${money(defaults.messagePrice)}) is not higher than this event's request price. Set an event price for it too.`;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      requestPrice: typeof requestPrice === "number" ? requestPrice : null,
      messagePrice: typeof messagePrice === "number" ? messagePrice : null,
    },
  };
}

/** Kept so callers can share one error shape across Settings and Events. */
export type AnyFieldErrors = SettingsFieldErrors | EventFieldErrors;
