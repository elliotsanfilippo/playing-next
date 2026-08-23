import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  CONNECT_SELECT,
  resolveConnectAccount,
} from "@/src/lib/stripeEnvironment";

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
      .select(CONNECT_SELECT)
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("DJ profile lookup failed:", profileError);

      return NextResponse.json(
        { error: "Unable to load your payment profile." },
        { status: 500 }
      );
    }

    const connect = resolveConnectAccount(djProfile);

    if (!connect.accountId) {
      return NextResponse.json(
        { error: "Connect Stripe before viewing your dashboard." },
        { status: 400 }
      );
    }

    /*
     * Gated on Stripe's own minimum, not on the account being perfect.
     *
     * This used to require the cached "connected" flag, which under the
     * old formula meant payouts enabled and nothing outstanding — so the
     * Express Dashboard, the one place a DJ resolves a payout hold or
     * uploads a document, was locked exactly when they needed it.
     * Stripe only requires that onboarding has been submitted, so that
     * is the bar. An account that has not got that far is sent to the
     * onboarding flow instead, which is the correct destination for it.
     */
    const account = await stripe.accounts.retrieve(connect.accountId);

    if (!account.details_submitted) {
      return NextResponse.json(
        {
          error: "Finish setting up your Stripe account first.",
          code: "onboarding_incomplete",
        },
        { status: 409 }
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(
      connect.accountId
    );

    return NextResponse.json({
      url: loginLink.url,
    });
  } catch (error) {
    console.error("Stripe dashboard link error:", error);

    return NextResponse.json(
      { error: "Unable to open your Stripe dashboard." },
      { status: 500 }
    );
  }
}
