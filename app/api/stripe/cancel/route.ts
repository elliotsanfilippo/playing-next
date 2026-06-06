import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentIntentId, requestId, accessToken } = body;

    if (!paymentIntentId || !requestId || !accessToken) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorised" },
        { status: 401 }
      );
    }

    const { data: songRequest, error: requestError } = await supabase
      .from("song_requests")
      .select("id, stripe_payment_intent_id, dj_profiles!inner(user_id)")
      .eq("id", requestId)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .single();

    if (requestError || !songRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    const profile = Array.isArray(songRequest.dj_profiles)
      ? songRequest.dj_profiles[0]
      : songRequest.dj_profiles;

    if (profile.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    return NextResponse.json(paymentIntent);
  } catch (error) {
    console.log("Stripe capture error:", error);

    return NextResponse.json(
      {
        error: "Stripe capture failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}