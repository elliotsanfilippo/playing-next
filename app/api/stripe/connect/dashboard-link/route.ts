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

/*
 * A one-time-use link into the DJ's own Express Dashboard on Stripe's
 * side — their balance, payout history and account details as Stripe
 * sees them, separate from this app's own Earnings page. Only issued
 * for accounts that have actually completed onboarding; Stripe rejects
 * login links for accounts that haven't.
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
      .select("stripe_account_id, stripe_connected")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("DJ profile lookup failed:", profileError);

      return NextResponse.json(
        { error: "Unable to load your payment profile." },
        { status: 500 }
      );
    }

    if (!djProfile?.stripe_account_id || !djProfile.stripe_connected) {
      return NextResponse.json(
        { error: "Connect Stripe before viewing your dashboard." },
        { status: 400 }
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(
      djProfile.stripe_account_id
    );

    return NextResponse.json({
      url: loginLink.url,
    });
  } catch (error) {
    console.error("Stripe dashboard link error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to open your Stripe dashboard.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
