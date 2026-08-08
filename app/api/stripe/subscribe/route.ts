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
      .select(
        "id, dj_name, plan, stripe_customer_id, stripe_subscription_status"
      )
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

    if (
      djProfile.plan === "pro" &&
      djProfile.stripe_subscription_status === "active"
    ) {
      return NextResponse.json(
        { error: "You're already subscribed to Pro." },
        { status: 409 }
      );
    }

    let customerId = djProfile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: djProfile.dj_name,
        metadata: {
          supabase_user_id: user.id,
          dj_profile_id: djProfile.id,
        },
      });

      customerId = customer.id;

      const { error: saveError } = await supabaseAdmin
        .from("dj_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", djProfile.id);

      if (saveError) {
        console.error("Stripe customer save failed:", saveError);

        return NextResponse.json(
          {
            error:
              "A billing account was created but could not be saved to your profile.",
          },
          { status: 500 }
        );
      }
    }

    const origin = request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!,
          quantity: 1,
        },
      ],
      metadata: {
        dj_profile_id: djProfile.id,
      },
      success_url: `${origin}/dj/settings?pro=success`,
      cancel_url: `${origin}/dj/settings`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe subscribe error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to start the Pro subscription checkout.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
