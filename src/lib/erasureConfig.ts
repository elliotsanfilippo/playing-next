/*
 * ── The erasure kill switch ───────────────────────────────────────
 *
 * The same shape and the same default as retentionConfig, because the
 * risk is the same shape: an irreversible write to Production, on a
 * database with no backups yet.
 *
 * `ERASURE_EXECUTION_ENABLED` must be present AND exactly "true". A
 * missing variable, an empty one, a typo, a "1", a "false", or a fresh
 * environment all mean disabled. There is no reading of it that fails
 * open.
 *
 * Lookup and classification are NOT gated by this: reading what we hold
 * about a person is safe, and being able to answer a subject access
 * request is useful long before erasure is armed. Only the write is
 * gated.
 */
export const ERASURE_EXECUTION_ENABLED =
  process.env.ERASURE_EXECUTION_ENABLED === "true";

export function assertErasureEnabled(): void {
  if (!ERASURE_EXECUTION_ENABLED) {
    throw new Error(
      "Erasure execution is disabled. Set ERASURE_EXECUTION_ENABLED=true only " +
        "after the workflow has been reviewed and a real privacy request needs it."
    );
  }
}
