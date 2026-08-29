/*
 * ── Accounts that must not count as external growth ───────────────
 *
 * Elliot's own DJ account, the original test account and a second
 * personal signup. They stay fully visible and searchable in Admin and
 * are tagged "Internal"; they are excluded only from the external
 * funnel, because counting the founder's own account as an activated DJ
 * is the exact vanity that made "14 signups" feel like progress while
 * no external DJ had ever taken a paid request.
 *
 * A slug allowlist rather than a database column, mirroring
 * ADMIN_EMAILS in src/lib/adminAuth.ts: there are three of them, they
 * change roughly never, and a schema change would be pure overhead.
 * Confirmed with Elliot on 2026-08-29.
 */
export const INTERNAL_DJ_SLUGS = [
  "dj-elliot-test",
  "elliotsanfilippo26",
  "elliot",
] as const;

export function isInternalDj(slug: string | null | undefined): boolean {
  return !!slug && (INTERNAL_DJ_SLUGS as readonly string[]).includes(slug);
}
