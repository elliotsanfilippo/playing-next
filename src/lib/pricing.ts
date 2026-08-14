export const SERVICE_FEE = 50; // 50p

export const VIP_PRICE = 100; // £1

export const VIP_SLOT_LIMIT = 3;

export const QR_BOX_SHIPPING_FEE = 399; // £3.99

export const QR_BOX_LIMIT = 50;

export const FREE_PLATFORM_FEE_BPS = 1500; // 15%

export const PRO_PLATFORM_FEE_BPS = 0;

export const PRICING_VERSION = "2026-08-v1";

/*
 * Display only — the amount actually charged comes from whichever
 * Stripe Price STRIPE_PRO_PRICE_ID points to. Changing this constant
 * does not change what anyone is billed; it exists purely so every
 * page quoting the Pro price says the same number, instead of each
 * one hardcoding its own copy of it. Update this AND the Stripe
 * Price/env var together, or the UI and the real charge will
 * disagree.
 */
export const PRO_MONTHLY_PRICE_GBP = 49.99;

/*
 * The request revenue at which Pro's 0% fee starts saving more than
 * the subscription costs, i.e. where FREE_PLATFORM_FEE_BPS of that
 * revenue equals PRO_MONTHLY_PRICE_GBP. Derived, not guessed.
 */
export const PRO_BREAK_EVEN_MONTHLY_GBP = Math.round(
  (PRO_MONTHLY_PRICE_GBP / (FREE_PLATFORM_FEE_BPS / 10_000)) / 1
);