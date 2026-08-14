/*
 * Preset amounts shown as one-tap buttons on the tip card, in pence.
 * A custom amount is always available alongside these.
 */
export const TIP_PRESETS_PENCE = [200, 500, 1000] as const;

export const TIP_MIN_PENCE = 100; // £1
export const TIP_MAX_PENCE = 10_000; // £100 — a sanity ceiling, not a real limit guests would hit

export function isValidTipAmount(pence: number): boolean {
  return (
    Number.isInteger(pence) && pence >= TIP_MIN_PENCE && pence <= TIP_MAX_PENCE
  );
}
