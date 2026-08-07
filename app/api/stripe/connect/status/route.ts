import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
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
      .select("id, stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("DJ profile lookup failed:", profileError);

      return NextResponse.json(
        { error: "Unable to load your payment profile." },
        { status: 500 }
      );
    }

    if (!djProfile?.stripe_account_id) {
      return NextResponse.json({
        hasAccount: false,
        connected: false,
        detailsSubmitted: false,
        payoutsEnabled: false,
        transfersActive: false,
        currentlyDue: [],
      });
    }

    const account = await stripe.accounts.retrieve(
      djProfile.stripe_account_id
    );

    const detailsSubmitted = account.details_submitted;
    const payoutsEnabled = account.payouts_enabled;
    const transfersActive =
      account.capabilities?.transfers === "active";

    const currentlyDue =
      account.requirements?.currently_due ?? [];

    const connected =
      detailsSubmitted &&
      payoutsEnabled &&
      transfersActive &&
      currentlyDue.length === 0;

    const { error: updateError } = await supabaseAdmin
      .from("dj_profiles")
      .update({
        stripe_connected: connected,
      })
      .eq("id", djProfile.id);

    if (updateError) {
      console.error("Stripe status save failed:", updateError);

      return NextResponse.json(
        { error: "Unable to save the Stripe account status." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasAccount: true,
      connected,
      detailsSubmitted,
      payoutsEnabled,
      transfersActive,
      currentlyDue,
    });
  } catch (error) {
    console.error("Stripe Connect status error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to check your Stripe status.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}