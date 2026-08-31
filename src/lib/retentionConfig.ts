/*
 * ── The kill switch ───────────────────────────────────────────────
 *
 * Destructive retention is off unless something outside the codebase
 * turns it on. Shipping the code must never be what arms it.
 *
 * The default is the whole point. `RETENTION_EXECUTION_ENABLED` has to
 * be present AND exactly "true" for execution to be permitted, so a
 * missing variable, an empty one, a typo, a "false", a "1", or a fresh
 * environment that nobody has configured all mean disabled. There is no
 * reading of this that fails open.
 *
 * As of 2026-08-31 there is no executor for this to guard. That is
 * deliberate: the switch exists before the thing it switches, so the
 * executor cannot be written without a guard already in place to call.
 *
 * Elliot's condition for arming it, recorded here because the reason
 * matters more than the flag: clearing a message is irreversible, and
 * Supabase backups are not yet in place, so until they are a bug in the
 * retention job would destroy guest messages with no recovery path.
 * Arming is his explicit decision, once backups exist.
 */
export const RETENTION_EXECUTION_ENABLED =
  process.env.RETENTION_EXECUTION_ENABLED === "true";

/**
 * Call at the top of any code path that would write or delete under a
 * retention rule. Throws rather than returning false: a caller that
 * forgets to check the result of a boolean still gets stopped.
 */
export function assertRetentionExecutionEnabled(): void {
  if (!RETENTION_EXECUTION_ENABLED) {
    throw new Error(
      "Retention execution is disabled. Set RETENTION_EXECUTION_ENABLED=true " +
        "only after database backups exist and activation has been approved."
    );
  }
}
