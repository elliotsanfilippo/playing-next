import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendPushToDJ } from "@/src/lib/webpush";

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

/*
 * Unlike the song-request success route, a tip has already been
 * captured and transferred to the DJ by the time a guest lands here —
 * there's no manual accept step waiting on it. This just reconciles
 * the row and notifies the DJ; the webhook is the backstop for a
 * guest whose browser never makes it back here at all.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("session_id");
    const tipId = request.nextUrl.searchParams.get("tipId");
    const djSlug = request.nextUrl.searchParams.get("djSlug");
    const origin = request.nextUrl.origin;

    if (!sessionId || !tipId || !djSlug) {
      return NextResponse.redirect(new URL("/", origin));
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    const metadataTipId = session.metadata?.tipId;

    if (!metadataTipId || metadataTipId !== tipId) {
      console.error("Tip checkout ID mismatch", { tipId, metadataTipId });

      return NextResponse.redirect(
        new URL(`/request/${djSlug}?tip_error=mismatch`, origin)
      );
    }

    const paymentIntent = session.payment_intent;

    const paymentIntentId =
      typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;

    const amountReceived =
      typeof paymentIntent === "object" && paymentIntent
        ? paymentIntent.amount_received
        : 0;

    if (!paymentIntentId || !amountReceived) {
      return NextResponse.redirect(
        new URL(`/request/${djSlug}?tip_error=incomplete`, origin)
      );
    }

    const { data: tip, error: updateError } = await supabaseAdmin
      .from("tips")
      .update({
        status: "succeeded",
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", tipId)
      .eq("status", "pending")
      .select("dj_profile_id, amount")
      .maybeSingle();

    if (updateError) {
      console.error("Tip update error:", updateError);
    }

    if (tip) {
      sendPushToDJ(tip.dj_profile_id, {
        title: "You got a tip! 🎉",
        body: `£${(tip.amount / 100).toFixed(2)} tip from a guest`,
        url: "/dj/dashboard",
      }).catch((pushError) => {
        console.error("Tip push notification error:", pushError);
      });
    }

    const confirmationUrl = new URL(`/request/${djSlug}`, origin);
    confirmationUrl.searchParams.set("tipped", "1");
    confirmationUrl.searchParams.set(
      "tipAmount",
      ((tip?.amount ?? 0) / 100).toFixed(2)
    );

    return NextResponse.redirect(confirmationUrl);
  } catch (error) {
    console.error("Tip success route error:", error);

    return NextResponse.redirect(
      new URL("/?payment_error=tip_success_failed", request.url)
    );
  }
}
