import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  CONNECT_SELECT,
  resolveConnectAccount,
} from "@/src/lib/stripeEnvironment";
import { classifyAccountError } from "@/src/lib/connectHealth";

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
        { error: "Create your Stripe account before starting onboarding." },
        { status: 400 }
      );
    }

    const origin = request.nextUrl.origin;

    const accountLink = await stripe.accountLinks.create({
      account: connect.accountId,
      type: "account_onboarding",
      return_url: `${origin}/dj/settings/payments?connect=return`,
      refresh_url: `${origin}/dj/settings/payments?connect=refresh`,
    });

    return NextResponse.json({
      url: accountLink.url,
    });
  } catch (error) {
    console.error("Stripe onboarding link error:", error);

    /* An account link failing usually means the stored id is unusable.
       Told plainly, without the raw Stripe text, and classified so the
       page can offer recovery rather than another Start setup button. */
    const reason = classifyAccountError(error);

    return NextResponse.json(
      {
        error:
          reason === "temporary"
            ? "Unable to start Stripe onboarding."
            : "We couldn't reach your Stripe account.",
        reason,
      },
      { status: 500 }
    );
  }
}