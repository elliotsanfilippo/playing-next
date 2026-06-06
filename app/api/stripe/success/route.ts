import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const sessionId = searchParams.get("session_id");
  const requestId = searchParams.get("requestId");
  const { data: songRequest } = await supabase
  .from("song_requests")
  .select("dj_profile_id")
  .eq("id", requestId)
  .single();

const { data: djProfile } = await supabase
  .from("dj_profiles")
  .select("slug")
  .eq("id", songRequest?.dj_profile_id)
  .single();

const djSlug = djProfile?.slug || "dj-elliot";

  if (!sessionId || !requestId) {
  return NextResponse.redirect(
  `https://playing-next.vercel.app`
);
}

  const session = await stripe.checkout.sessions.retrieve(
    sessionId,
    {
      expand: ["payment_intent"],
    }
  );

  const paymentIntent = session.payment_intent;

  const paymentIntentId =
    typeof paymentIntent === "string"
      ? paymentIntent
      : paymentIntent?.id;

  if (paymentIntentId) {
    await supabase
  .from("song_requests")
  .update({
  request_status: "pending",
  stripe_payment_intent_id: paymentIntentId,
})
  .eq("id", requestId);
  }

  return NextResponse.redirect(
  `https://playing-next.vercel.app/request/${djSlug}/confirmation?requestId=${requestId}`
);
}