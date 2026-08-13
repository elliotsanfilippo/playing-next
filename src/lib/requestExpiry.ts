/*
 * How long a DJ has to accept or decline before a request expires on
 * its own. The guest's card is only ever authorised while pending, so
 * expiry releases that authorisation — nobody is charged and there is
 * nothing to refund.
 *
 * Stripe independently auto-cancels an uncaptured authorisation after
 * 7 days, so this is about not leaving a guest staring at "waiting for
 * the DJ" all night, not about money being stuck.
 */
export const REQUEST_EXPIRY_HOURS = 2;

export function expiryCutoffISO(now: Date = new Date()): string {
  return new Date(
    now.getTime() - REQUEST_EXPIRY_HOURS * 3_600_000
  ).toISOString();
}
