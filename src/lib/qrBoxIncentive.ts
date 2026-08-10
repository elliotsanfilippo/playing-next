import { createClient } from "@supabase/supabase-js";
import { QR_BOX_LIMIT } from "./pricing";

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
 * Called from both places a DJ can complete the last of the two
 * requirements (onboarding, Pro subscription) — whichever happens
 * second is what actually triggers eligibility, so both call sites
 * need to run the same check.
 *
 * The count-then-update isn't wrapped in a database transaction, so
 * it's theoretically possible for two DJs completing the last
 * requirement in the same instant to both slip in as the 50th slot.
 * Given this only fires on rare, human-paced actions (finishing
 * onboarding, subscribing to Pro) rather than any high-frequency path,
 * that's an acceptable trade against the complexity of a fully atomic
 * check.
 */
export async function checkAndMarkQrBoxEligible(djProfileId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("dj_profiles")
    .select("onboarding_complete, plan, qr_box_eligible")
    .eq("id", djProfileId)
    .maybeSingle();

  if (error || !profile) {
    console.error("QR box eligibility profile lookup error:", error);
    return;
  }

  if (profile.qr_box_eligible) return;
  if (!profile.onboarding_complete || profile.plan !== "pro") return;

  const { count, error: countError } = await supabaseAdmin
    .from("dj_profiles")
    .select("id", { count: "exact", head: true })
    .eq("qr_box_eligible", true);

  if (countError) {
    console.error("QR box eligibility count error:", countError);
    return;
  }

  if ((count ?? 0) >= QR_BOX_LIMIT) return;

  const { error: updateError } = await supabaseAdmin
    .from("dj_profiles")
    .update({ qr_box_eligible: true })
    .eq("id", djProfileId)
    .eq("qr_box_eligible", false);

  if (updateError) {
    console.error("QR box eligibility update error:", updateError);
  }
}
