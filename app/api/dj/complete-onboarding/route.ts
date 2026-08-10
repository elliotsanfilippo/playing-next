import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAndMarkQrBoxEligible } from "@/src/lib/qrBoxIncentive";

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
 * A dedicated server route rather than the DJ's own client updating
 * onboarding_complete directly — checking QR box incentive eligibility
 * needs a platform-wide count of eligible DJs, which isn't something
 * an individual DJ's RLS-scoped session should be able to read.
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

    const { data: djProfile, error: profileError } = await supabaseAdmin
      .from("dj_profiles")
      .select(
        "id, dj_name, request_price, profile_image_url, stripe_connected"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !djProfile) {
      return NextResponse.json(
        { error: "No DJ profile was found." },
        { status: 404 }
      );
    }

    const onboardingComplete =
      djProfile.dj_name !== "New DJ" &&
      (djProfile.request_price || 0) > 0 &&
      Boolean(djProfile.profile_image_url) &&
      Boolean(djProfile.stripe_connected);

    if (!onboardingComplete) {
      return NextResponse.json(
        { error: "Setup isn't complete yet." },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("dj_profiles")
      .update({ onboarding_complete: true })
      .eq("id", djProfile.id);

    if (updateError) {
      console.error("Onboarding completion update error:", updateError);

      return NextResponse.json(
        { error: "Unable to update your profile." },
        { status: 500 }
      );
    }

    await checkAndMarkQrBoxEligible(djProfile.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Complete onboarding route error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error." },
      { status: 500 }
    );
  }
}
