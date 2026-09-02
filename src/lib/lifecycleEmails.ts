import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_EMAIL_ATTEMPTS, type RecoveryState, type RecoveryTemplate } from "./recoveryEligibility.ts";

/*
 * ── Claiming, settling and retrying a lifecycle email ─────────────
 *
 * Every write to dj_lifecycle_emails goes through this module, so the
 * rules that were proven in the test project exist in exactly one place.
 *
 * The order is always: claim, then send, then settle. Never send first.
 * A crash between the claim and the send costs one email; a crash
 * between a send and a claim would cost a duplicate, and a duplicate
 * cannot be withdrawn.
 */

export type ClaimOutcome =
  | { claimed: true; id: string; attempts: number }
  | { claimed: false; reason: string };

/**
 * Take exclusive ownership of one (DJ, template) send.
 *
 * Two paths, because a first send and a retry are different operations
 * against a table with a unique index:
 *
 *   first send   INSERT. The unique index decides the winner; 23505
 *                means somebody else already owns it.
 *   retry        UPDATE, compare-and-swap on status AND attempts.
 *
 * The retry cannot be a self-referencing UPDATE (`attempts = attempts +
 * 1`) because PostgREST treats the value as a literal and raises 22P02,
 * so `attempts` is read first and then included in the predicate. That
 * turns a read-modify-write into a genuine compare-and-swap: two workers
 * that both read attempts = 1 both ask for `attempts = 1`, and under
 * READ COMMITTED the loser re-evaluates its predicate against the
 * updated row, matches nothing, and updates zero rows.
 *
 * Verified against the isolated test project: eight concurrent claims on
 * one failed row produced exactly one winner, and zero winners against
 * claimed, sent, and capped rows.
 */
export async function claimSend(
  db: SupabaseClient,
  djProfileId: string,
  template: RecoveryTemplate,
  state: Exclude<RecoveryState, "ready">
): Promise<ClaimOutcome> {
  const { data: existing, error: readError } = await db
    .from("dj_lifecycle_emails")
    .select("id, status, attempts")
    .eq("dj_profile_id", djProfileId)
    .eq("template_key", template)
    .maybeSingle();

  if (readError) return { claimed: false, reason: `lookup failed: ${readError.message}` };

  if (!existing) {
    const { data, error } = await db
      .from("dj_lifecycle_emails")
      .insert({
        dj_profile_id: djProfileId,
        template_key: template,
        state_at_send: state,
        status: "claimed",
        attempts: 1,
      })
      .select("id")
      .single();

    /* 23505 is not an error worth reporting. It is the unique index
       doing its job while another invocation was a millisecond ahead. */
    if (error) {
      return {
        claimed: false,
        reason: error.code === "23505" ? "claimed by another run" : `insert failed: ${error.message}`,
      };
    }

    return { claimed: true, id: data.id, attempts: 1 };
  }

  if (existing.status === "sent") return { claimed: false, reason: "already sent" };

  /* Deliberately never retried. The provider outcome of a claimed row is
     unknown, and resolving that uncertainty by sending again is how a DJ
     gets the same email twice. It surfaces in PN Admin as uncertain. */
  if (existing.status === "claimed") return { claimed: false, reason: "delivery uncertain" };

  if (existing.attempts >= MAX_EMAIL_ATTEMPTS) {
    return { claimed: false, reason: "out of attempts" };
  }

  const next = existing.attempts + 1;

  const { data, error } = await db
    .from("dj_lifecycle_emails")
    .update({ status: "claimed", attempts: next, state_at_send: state })
    .eq("dj_profile_id", djProfileId)
    .eq("template_key", template)
    .eq("status", "failed")
    .eq("attempts", existing.attempts)
    .lt("attempts", MAX_EMAIL_ATTEMPTS)
    .select("id");

  if (error) return { claimed: false, reason: `retry claim failed: ${error.message}` };
  if (!data || data.length !== 1) return { claimed: false, reason: "claimed by another run" };

  return { claimed: true, id: data[0].id, attempts: next };
}

/**
 * Record what the provider actually did.
 *
 * `last_error_at` is never cleared on a later success: a row carrying
 * both it and `sent_at` says "failed at X, delivered at Y", which is
 * true and is the kind of thing worth being able to see afterwards.
 */
export async function settleSend(
  db: SupabaseClient,
  id: string,
  outcome: { ok: true; providerMessageId: string | null } | { ok: false }
): Promise<void> {
  const patch = outcome.ok
    ? {
        status: "sent" as const,
        sent_at: new Date().toISOString(),
        provider_message_id: outcome.providerMessageId,
      }
    : { status: "failed" as const, last_error_at: new Date().toISOString() };

  const { error } = await db.from("dj_lifecycle_emails").update(patch).eq("id", id);

  if (error) {
    /* Loud, because this is the state that leaves a row stuck as
       claimed, and a stuck row is never retried by design. */
    console.error("Lifecycle email settle failed:", id, error.message);
  }
}

/** Every prior send for one DJ, for the eligibility check. */
export async function priorSendsFor(db: SupabaseClient, djProfileId: string) {
  const { data, error } = await db
    .from("dj_lifecycle_emails")
    .select("template_key, status, attempts, created_at, sent_at")
    .eq("dj_profile_id", djProfileId);

  if (error) throw new Error(`Could not read lifecycle email history: ${error.message}`);

  return data ?? [];
}
