import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";

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

type WithdrawBody = {
  amount?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `stripe-withdraw:${getClientIp(request)}`,
      5,
      60_000
    );

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": retryAfterSeconds.toString() },
        }
      );
    }

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json(
        { error: "Your session is invalid or has expired." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as WithdrawBody;
    const amount = body.amount;

    if (!Number.isInteger(amount) || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Enter a valid amount to withdraw." },
        { status: 400 }
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
        { error: "Unable to load your DJ profile." },
        { status: 500 }
      );
    }

    if (!djProfile?.stripe_account_id || !djProfile.stripe_connected) {
      return NextResponse.json(
        { error: "Connect Stripe before withdrawing." },
        { status: 409 }
      );
    }

    const stripeAccount = djProfile.stripe_account_id;

    /*
     * Re-check the live balance server-side rather than trusting the
     * client-supplied amount against a figure it fetched separately —
     * the balance can move between the DJ loading the page and clicking
     * Withdraw.
     */
    const balance = await stripe.balance.retrieve({}, { stripeAccount });
    const available =
      balance.available.find((b) => b.currency === "gbp")?.amount ?? 0;

    if (amount > available) {
      return NextResponse.json(
        {
          error: `You only have £${(available / 100).toFixed(
            2
          )} available to withdraw.`,
        },
        { status: 409 }
      );
    }

    const payout = await stripe.payouts.create(
      {
        amount,
        currency: "gbp",
      },
      { stripeAccount }
    );

    return NextResponse.json({
      id: payout.id,
      amount: payout.amount,
      status: payout.status,
    });
  } catch (error) {
    console.error("Stripe withdraw error:", error);

    const message =
      error instanceof Error ? error.message : "Unable to withdraw right now.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
