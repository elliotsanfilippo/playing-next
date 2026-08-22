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
      .select(CONNECT_SELECT)
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("DJ profile lookup failed:", profileError);

      return NextResponse.json(
        { error: "Unable to load your DJ profile." },
        { status: 500 }
      );
    }

    const connect = resolveConnectAccount(djProfile);

    if (!connect.accountId || !connect.connected) {
      return NextResponse.json({
        connected: false,
        balance: null,
        payouts: [],
      });
    }

    const stripeAccount = connect.accountId;

    /*
     * Migrates DJs whose Connect account was created before manual
     * payouts became the default. Best-effort: a failure here shouldn't
     * block loading the DJ's own balance and payout history.
     */
    try {
      const account = await stripe.accounts.retrieve(stripeAccount);

      if (account.settings?.payouts?.schedule?.interval !== "manual") {
        await stripe.accounts.update(stripeAccount, {
          settings: {
            payouts: {
              schedule: {
                interval: "manual",
              },
            },
          },
        });
      }
    } catch (scheduleError) {
      console.error("Payout schedule migration error:", scheduleError);
    }

    const [balance, payouts] = await Promise.all([
      stripe.balance.retrieve({}, { stripeAccount }),
      stripe.payouts.list({ limit: 10 }, { stripeAccount }),
    ]);

    const gbpAvailable = balance.available.find((b) => b.currency === "gbp");
    const gbpPending = balance.pending.find((b) => b.currency === "gbp");

    return NextResponse.json({
      connected: true,
      balance: {
        available: gbpAvailable?.amount ?? 0,
        pending: gbpPending?.amount ?? 0,
      },
      payouts: payouts.data.map((payout) => ({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        arrivalDate: payout.arrival_date,
        created: payout.created,
      })),
    });
  } catch (error) {
    console.error("Stripe payouts fetch error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to load payout information.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
