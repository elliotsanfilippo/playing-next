import { NextRequest, NextResponse } from "next/server";
import {
  canStartNewSubscription,
  isProEntitled,
} from "@/src/lib/planEntitlement";
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

    /*
     * Refuses whenever a subscription already exists in any form, not
     * only an active one.
     *
     * Subscription-mode Checkout creates a new subscription every time
     * it is called, and Stripe will not dedupe them. The old guard only
     * caught "active", so a DJ sitting on past_due, incomplete, unpaid
     * or paused could open a second checkout and pay twice for one plan
     * — with the webhook storing only one subscription id, leaving the
     * other invisible to the app but still billing.
     *
     * Those DJs belong in the billing portal, so the response says so
     * and carries a code the page can route on.
     */
    if (!canStartNewSubscription(djProfile)) {
      return NextResponse.json(
        {
          error: isProEntitled(djProfile)
            ? "You're already on Pro. Manage your billing to change or cancel it."
            : "You already have a Pro subscription that needs attention. Open billing to sort it out.",
          code: "subscription_exists",
        },
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

    if (!process.env.STRIPE_PRO_PRICE_ID) {
      console.error("STRIPE_PRO_PRICE_ID is not configured.");

      return NextResponse.json(
        { error: "Pro subscriptions aren't available right now." },
        { status: 500 }
      );
    }

    const origin = request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID,
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
    /* Logged in full, reported generically. A raw Stripe message names
       the price id and other internals and helps nobody upgrading. */
    console.error("Stripe subscribe error:", error);

    return NextResponse.json(
      { error: "Unable to start the Pro subscription checkout." },
      { status: 500 }
    );
  }
}
