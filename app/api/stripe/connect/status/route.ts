import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  CONNECT_SELECT,
  connectColumns,
  resolveConnectAccount,
} from "@/src/lib/stripeEnvironment";
import {
  NO_ACCOUNT_HEALTH,
  classifyAccountError,
  readConnectHealth,
} from "@/src/lib/connectHealth";

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
      .select(`id, ${CONNECT_SELECT}`)
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
      return NextResponse.json({ health: NO_ACCOUNT_HEALTH, reachable: true });
    }

    let account;

    try {
      account = await stripe.accounts.retrieve(connect.accountId);
    } catch (retrieveError) {
      /*
       * The account could not be read, which is not the same as the
       * account being unhealthy.
       *
       * The cached flag is deliberately left alone here. Writing false
       * on a failed read would let a momentary Stripe blip take a DJ
       * offline for every guest, since that column gates checkout — the
       * exact failure this phase exists to remove. An unreadable account
       * is reported as unknown and the last known state stands.
       */
      const reason = classifyAccountError(retrieveError);

      console.error(
        `Connect account ${connect.accountId} unreadable (${reason}):`,
        retrieveError
      );

      return NextResponse.json({
        reachable: false,
        reason,
        /* So the page can offer recovery without guessing whether an
           account was ever stored. */
        hasStoredAccount: true,
      });
    }

    const health = readConnectHealth(account);

    /*
     * The cached boolean now answers exactly one question: can a
     * destination transfer to this account succeed. That is what guest
     * checkout gates on, and it is the only thing it should ever have
     * gated on. Payout health lives in this response and is never
     * flattened into the column.
     */
    const { error: updateError } = await supabaseAdmin
      .from("dj_profiles")
      /* Written to whichever column belongs to the running mode, so a
         test-mode status check can never flip a DJ's live flag. */
      .update({ [connectColumns().connected]: health.canReceiveEarnings })
      .eq("id", djProfile!.id);

    if (updateError) {
      console.error("Stripe status save failed:", updateError);

      return NextResponse.json(
        { error: "Unable to save the Stripe account status." },
        { status: 500 }
      );
    }

    return NextResponse.json({ health, reachable: true });
  } catch (error) {
    /* Logged in full, reported generically. Raw Stripe messages name
       internal parameters and key prefixes and are no use to a DJ. */
    console.error("Stripe Connect status error:", error);

    return NextResponse.json(
      { error: "Unable to check your Stripe status." },
      { status: 500 }
    );
  }
}