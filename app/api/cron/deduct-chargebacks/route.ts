import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deductChargebackTransfer } from "@/src/lib/chargebacks";
import { sendPushToDJ } from "@/src/lib/webpush";

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

const BATCH_LIMIT = 100;

/*
 * Runs daily (see vercel.json). Disputes a DJ actively contested are
 * left alone — dj_response is "disputed", not "pending", so the query
 * below never touches them; resolving those is a manual, off-platform
 * decision at this DJ count.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");

    return NextResponse.json(
      { error: "Scheduled tasks are not configured." },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const { data: overdue, error: loadError } = await supabaseAdmin
      .from("chargeback_disputes")
      .select("id, dj_profile_id, description, disputed_amount")
      .eq("dj_response", "pending")
      .eq("deduction_status", "pending")
      .lt("respond_by", new Date().toISOString())
      .limit(BATCH_LIMIT);

    if (loadError) {
      console.error("Chargeback sweep load error:", loadError);

      return NextResponse.json(
        { error: "Unable to load overdue disputes." },
        { status: 500 }
      );
    }

    if (!overdue || overdue.length === 0) {
      return NextResponse.json({ deducted: 0, checked: 0 });
    }

    let deducted = 0;

    for (const dispute of overdue) {
      const result = await deductChargebackTransfer(dispute.id);

      if (result.success) {
        deducted += 1;

        sendPushToDJ(dispute.dj_profile_id, {
          title: "A disputed charge was deducted",
          body: `£${(dispute.disputed_amount / 100).toFixed(2)} for "${dispute.description}" was deducted from your payout after no response.`,
          url: "/dj/dashboard",
        }).catch((pushError) => {
          console.error(
            "Chargeback deduction push notification error:",
            pushError
          );
        });
      } else {
        console.error(
          "Chargeback auto-deduction failed:",
          dispute.id,
          result.reason
        );
      }
    }

    return NextResponse.json({ deducted, checked: overdue.length });
  } catch (error) {
    console.error("Chargeback deduction sweep error:", error);

    return NextResponse.json(
      {
        error: "Chargeback sweep failed.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
