import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/*
 * How long a DJ has to accept or dispute a chargeback before it's
 * deducted from their payout automatically. Mirrors the reasoning in
 * requestExpiry.ts — this is a deadline for a human decision, not a
 * technical timeout.
 */
export const CHARGEBACK_RESPONSE_WINDOW_DAYS = 7;

export function chargebackDeadlineISO(now: Date = new Date()): string {
  return new Date(
    now.getTime() + CHARGEBACK_RESPONSE_WINDOW_DAYS * 24 * 3_600_000
  ).toISOString();
}

type CreateChargebackDisputeParams = {
  djProfileId: string;
  sourceTable: "song_requests" | "tips";
  sourceId: string;
  stripeDisputeId: string;
  stripeChargeId: string | null;
  disputedAmount: number;
  description: string;
};

/*
 * Only the DJ's own cut (dj_earnings) is ever clawed back — the
 * platform fee and guest service fee were platform revenue, and their
 * loss on a dispute stays the platform's problem, not the DJ's.
 */
export async function createChargebackDispute(
  params: CreateChargebackDisputeParams
) {
  const { error } = await supabaseAdmin.from("chargeback_disputes").insert({
    dj_profile_id: params.djProfileId,
    source_table: params.sourceTable,
    source_id: params.sourceId,
    stripe_dispute_id: params.stripeDisputeId,
    stripe_charge_id: params.stripeChargeId,
    disputed_amount: params.disputedAmount,
    description: params.description,
    respond_by: chargebackDeadlineISO(),
  });

  if (error) {
    console.error("Chargeback dispute insert error:", error);
  }
}

/*
 * Pulls the DJ's earnings back from their Connect balance via a
 * transfer reversal. Destination charges create their Transfer
 * automatically at charge time, so the transfer to reverse is looked
 * up from the original charge rather than stored up front — disputes
 * are rare enough that this lazy lookup costs nothing.
 *
 * Called from two places: immediately when a DJ accepts a dispute, and
 * from the daily cron sweep for anyone who never responded. Guarded on
 * deduction_status still being "pending" so both paths are safe to
 * call more than once.
 */
export async function deductChargebackTransfer(
  disputeId: string
): Promise<{ success: true } | { success: false; reason: string }> {
  const { data: dispute, error } = await supabaseAdmin
    .from("chargeback_disputes")
    .select("id, disputed_amount, stripe_charge_id, deduction_status")
    .eq("id", disputeId)
    .maybeSingle();

  if (error || !dispute) {
    return { success: false, reason: "Dispute not found." };
  }

  if (dispute.deduction_status !== "pending") {
    return { success: true };
  }

  if (!dispute.stripe_charge_id) {
    await supabaseAdmin
      .from("chargeback_disputes")
      .update({ deduction_status: "failed" })
      .eq("id", disputeId);

    return { success: false, reason: "No charge on file for this dispute." };
  }

  let transferId: string | null = null;

  try {
    const charge = await stripe.charges.retrieve(dispute.stripe_charge_id);
    transferId =
      typeof charge.transfer === "string"
        ? charge.transfer
        : (charge.transfer?.id ?? null);
  } catch (retrieveError) {
    console.error("Chargeback charge lookup failed:", retrieveError);
  }

  if (!transferId) {
    await supabaseAdmin
      .from("chargeback_disputes")
      .update({ deduction_status: "failed" })
      .eq("id", disputeId);

    return { success: false, reason: "No transfer found to reverse." };
  }

  try {
    await stripe.transfers.createReversal(transferId, {
      amount: dispute.disputed_amount,
      description: `Chargeback deduction (dispute ${disputeId})`,
    });
  } catch (reversalError) {
    console.error("Chargeback transfer reversal failed:", reversalError);

    await supabaseAdmin
      .from("chargeback_disputes")
      .update({ deduction_status: "failed" })
      .eq("id", disputeId);

    return { success: false, reason: "Transfer reversal failed." };
  }

  await supabaseAdmin
    .from("chargeback_disputes")
    .update({
      deduction_status: "deducted",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId);

  return { success: true };
}
