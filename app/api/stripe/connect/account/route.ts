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
      .select("id, dj_name, stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("DJ profile lookup failed:", profileError);

      return NextResponse.json(
        { error: "Unable to load your DJ profile." },
        { status: 500 }
      );
    }

    if (!djProfile) {
      return NextResponse.json(
        { error: "No DJ profile was found." },
        { status: 404 }
      );
    }

    if (djProfile.stripe_account_id) {
      return NextResponse.json({
        accountId: djProfile.stripe_account_id,
        created: false,
      });
    }

    const account = await stripe.accounts.create(
      {
        country: "GB",
        email: user.email ?? undefined,

        business_profile: {
          name: djProfile.dj_name,
          product_description:
            "Song request payments received through Playing Next.",
        },

        controller: {
          stripe_dashboard: {
            type: "express",
          },
          fees: {
            payer: "application",
          },
          losses: {
            payments: "application",
          },
        },

        capabilities: {
          transfers: {
            requested: true,
          },
        },

        /*
         * Manual payout schedule — DJs withdraw on their own terms via the
         * earnings page rather than having Stripe sweep their balance out
         * automatically on its own timing.
         */
        settings: {
          payouts: {
            schedule: {
              interval: "manual",
            },
          },
        },

        metadata: {
          supabase_user_id: user.id,
          dj_profile_id: djProfile.id,
        },
      },
      {
        idempotencyKey: `playing-next-connect-${djProfile.id}`,
      }
    );

    const { error: saveError } = await supabaseAdmin
      .from("dj_profiles")
      .update({
        stripe_account_id: account.id,
        stripe_connected: false,
      })
      .eq("id", djProfile.id);

    if (saveError) {
      console.error("Connected account save failed:", saveError);

      return NextResponse.json(
        {
          error:
            "The Stripe account was created but could not be saved to your profile.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      accountId: account.id,
      created: true,
    });
  } catch (error: any) {
  console.error("========== STRIPE ACCOUNT ERROR ==========");
  console.error("Message:", error?.message);
  console.error("Type:", error?.type);
  console.error("Code:", error?.code);
  console.error("Param:", error?.param);
  console.error("Raw:", error?.raw);

  return NextResponse.json(
    {
      error:
        error?.message ||
        "Stripe rejected the connected account request.",
    },
    { status: error?.statusCode || 500 }
  );
}
}