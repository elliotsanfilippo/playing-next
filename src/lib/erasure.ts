/*
 * ── What a privacy request may erase, decided in one pure place ───
 *
 * No I/O. Callers pass a row in and get a decision back, so the rules
 * can be reasoned about and tested without a database, and there is no
 * path from this module to a write.
 *
 * The shape of the whole design, in one sentence: erasure clears
 * personal FIELDS and never removes a row. Once the personal field is
 * null the row holds no personal data, so the request is satisfied;
 * removing the row would be minimisation, which is a different
 * obligation with a different gate (R4, still unbuilt and unarmed).
 */
import type { PaymentClass } from "@/src/lib/retention";

export const ERASABLE_OBJECT_TYPES = [
  "song_request",
  "tip",
  "not_played_report",
  "qr_box_order",
] as const;

export type ErasableObjectType = (typeof ERASABLE_OBJECT_TYPES)[number];

export const OBJECT_LABELS: Record<ErasableObjectType, string> = {
  song_request: "Song request",
  tip: "Tip",
  not_played_report: "Not-played report",
  qr_box_order: "QR box order",
};

/*
 * The personal fields, per object. Everything not listed here is
 * financial or operational and is retained.
 *
 * Compiled from a sweep of all 13 Production tables on 2026-08-31. The
 * QR box address arrived from that sweep after an earlier inventory,
 * built only from the tables we already knew about, missed it entirely.
 */
export const ERASABLE_FIELDS: Record<ErasableObjectType, string[]> = {
  song_request: ["message"],
  tip: ["message"],
  not_played_report: ["reason"],
  qr_box_order: [
    "recipient_name",
    "address_line1",
    "address_line2",
    "city",
    "postcode",
    "country",
  ],
};

/*
 * What is kept, phrased for the admin to read back to the person. The
 * UI must never imply a payment record is being deleted, so the retained
 * side is stated as plainly as the erased side.
 */
export const RETAINED_SUMMARY: Record<ErasableObjectType, string> = {
  song_request:
    "Amount, fees, DJ earnings, payment reference, status, song, artist and timestamps",
  tip: "Amount, fees, DJ earnings, payment reference, status and timestamps",
  not_played_report:
    "The report itself, its outcome, and which request it concerned",
  qr_box_order: "Order status, shipping amount, payment reference and timestamps",
};

/*
 * ── Proving entitlement, which is not the same as finding the row ──
 *
 * Anyone who was at that gig can name the DJ, the date and the song. If
 * attribute matching authorised erasure, a stranger could erase someone
 * else's message. So locating and authorising are separate steps, and
 * only these three count as proof.
 */
export const VERIFICATION_METHODS = [
  "stripe_payment",
  "my_requests_link",
  "quoted_message",
] as const;

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const VERIFICATION_LABELS: Record<VerificationMethod, string> = {
  stripe_payment:
    "Stripe shows a payment under the email they contacted us from",
  my_requests_link: "They supplied a My Requests link containing this record",
  quoted_message: "They quoted the message text back accurately",
};

export function isVerificationMethod(v: unknown): v is VerificationMethod {
  return (VERIFICATION_METHODS as readonly unknown[]).includes(v);
}

/** PN Admin's own privacy-request reference. Mirrors the CHECK exactly. */
export const REQUEST_REFERENCE_PATTERN = /^PR-[0-9]{4}-[0-9]{3,}$/;

export function isValidRequestReference(v: unknown): v is string {
  return typeof v === "string" && REQUEST_REFERENCE_PATTERN.test(v);
}

/* ── Eligibility ───────────────────────────────────────────────── */

export type EligibilityInput = {
  objectType: ErasableObjectType;
  /** Present personal fields, by name. Never their values. */
  presentFields: string[];
  classification: PaymentClass;
  /** qr_box_orders only. */
  orderStatus?: string | null;
};

export type Eligibility = {
  eligible: boolean;
  /** The fields this action would clear. Empty when not eligible. */
  fields: string[];
  retained: string;
  /** Why, in words the admin can read back to the person. */
  reason: string;
};

export function eligibility(input: EligibilityInput): Eligibility {
  const all = ERASABLE_FIELDS[input.objectType];
  const present = all.filter((f) => input.presentFields.includes(f));
  const retained = RETAINED_SUMMARY[input.objectType];

  if (present.length === 0) {
    return {
      eligible: false,
      fields: [],
      retained,
      reason: "There is no personal data left on this record to erase.",
    };
  }

  /*
   * A QR box address is the one case where erasure can be refused on
   * the merits rather than on evidence.
   *
   * A paid order still needs the address: fulfilment, a failed delivery,
   * a replacement, a return and courier support can each require it, and
   * no column in this database can prove the box arrived. There is no
   * dispatched or delivered state, so the honest answer is that we
   * cannot yet tell, and an admin ticking "I confirm it shipped" would
   * be a guess dressed as authority.
   */
  if (input.objectType === "qr_box_order") {
    if (input.orderStatus !== "pending_payment") {
      return {
        eligible: false,
        fields: [],
        retained,
        reason:
          "This order was paid for. The address is retained while it may still be needed for fulfilment, delivery problems, returns or courier support. Cancelling and refunding the order is the route to removing it.",
      };
    }
    if (input.classification !== "never_charged") {
      return {
        eligible: false,
        fields: [],
        retained,
        reason:
          "This order's payment state is not positively established, so the address is retained until it is.",
      };
    }
    return {
      eligible: true,
      fields: present,
      retained,
      reason:
        "The claim was abandoned before payment, so the address serves no purpose and can be cleared.",
    };
  }

  /*
   * For everything else the personal field is erasable in every payment
   * class. Payment state decides what is RETAINED alongside it, never
   * whether the person's own words can be removed.
   */
  const byClass: Record<PaymentClass, string> = {
    preserve:
      "The message is cleared. The transaction is kept as a financial record.",
    never_charged:
      "The message is cleared. No payment was taken; the remaining fields hold no personal data.",
    unknown:
      "The message is cleared. The record is kept because its payment state is not positively established.",
  };

  return {
    eligible: true,
    fields: present,
    retained,
    reason: byClass[input.classification],
  };
}
