import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deductChargebackTransfer } from "@/src/lib/chargebacks";

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

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function authenticate(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return user;
}

/*
 * "Accept" deducts immediately rather than waiting out the rest of the
 * 7-day window — once the DJ has confirmed it, there's no reason to
 * make them wait. "Dispute" just flags it; resolving a contested
 * chargeback is a manual, off-platform decision at this DJ count, not
 * a workflow worth building yet.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json(
        { error: "Your session is invalid or has expired." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const disputeId =
      typeof body.disputeId === "string" ? body.disputeId.trim() : "";
    const response = body.response;

    if (!disputeId || (response !== "accept" && response !== "dispute")) {
      return NextResponse.json(
        { error: "Missing or invalid dispute response." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("dj_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "DJ profile could not be found." },
        { status: 404 }
      );
    }

    const { data: dispute, error: disputeError } = await supabaseAdmin
      .from("chargeback_disputes")
      .select("id, dj_profile_id, dj_response")
      .eq("id", disputeId)
      .maybeSingle();

    if (disputeError || !dispute || dispute.dj_profile_id !== profile.id) {
      return NextResponse.json(
        { error: "Dispute not found." },
        { status: 404 }
      );
    }

    if (dispute.dj_response !== "pending") {
      return NextResponse.json(
        { error: "This dispute has already been responded to." },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("chargeback_disputes")
      .update({
        dj_response: response === "accept" ? "accepted" : "disputed",
      })
      .eq("id", disputeId)
      .eq("dj_response", "pending");

    if (updateError) {
      console.error("Chargeback response update error:", updateError);

      return NextResponse.json(
        { error: "Unable to record your response." },
        { status: 500 }
      );
    }

    if (response === "accept") {
      const result = await deductChargebackTransfer(disputeId);

      if (!result.success) {
        return NextResponse.json(
          {
            error:
              "Your response was recorded, but the deduction couldn't be completed automatically. We'll follow up.",
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Chargeback respond route error:", error);

    return NextResponse.json(
      { error: "Unable to record your response." },
      { status: 500 }
    );
  }
}
