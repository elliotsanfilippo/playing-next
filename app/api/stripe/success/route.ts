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

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("session_id");
    const requestId = request.nextUrl.searchParams.get("requestId");
    const origin = request.nextUrl.origin;

    if (!sessionId || !requestId) {
      return NextResponse.redirect(new URL("/", origin));
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    const metadataRequestId = session.metadata?.requestId;

    if (!metadataRequestId || metadataRequestId !== requestId) {
      console.error("Checkout request ID mismatch", {
        requestId,
        metadataRequestId,
      });

      return NextResponse.redirect(
        new URL("/?payment_error=request_mismatch", origin)
      );
    }

    const paymentIntent = session.payment_intent;

    const paymentIntentId =
      typeof paymentIntent === "string"
        ? paymentIntent
        : paymentIntent?.id;

    if (!paymentIntentId) {
      return NextResponse.redirect(
        new URL("/?payment_error=missing_payment_intent", origin)
      );
    }

    /*
     * A non-null ID only proves a PaymentIntent exists, not that the
     * card was actually authorised — a guest who reaches this URL
     * with a declined or otherwise-unconfirmed intent (e.g. by
     * visiting it manually with a session_id seen in the browser bar,
     * rather than via Stripe's own redirect) would otherwise still
     * get their request marked pending and the DJ notified, with
     * nothing actually held on their card. requires_capture is the
     * correct proof of a successful authorisation for this
     * manual-capture flow, mirroring the amount_received check in
     * tip-success and the payment_status check in qr-box-success.
     */
    const paymentIntentStatus =
      typeof paymentIntent === "object" ? paymentIntent?.status : undefined;

    if (paymentIntentStatus !== "requires_capture") {
      console.error("Checkout success hit with unauthorised payment intent", {
        requestId,
        paymentIntentId,
        paymentIntentStatus,
      });

      return NextResponse.redirect(
        new URL("/?payment_error=payment_not_authorised", origin)
      );
    }

    const { data: songRequest, error: requestError } =
      await supabaseAdmin
        .from("song_requests")
        .select("id, dj_profile_id, song_title, artist, request_type")
        .eq("id", requestId)
        .maybeSingle();

    if (requestError || !songRequest) {
      console.error("Song request lookup error:", requestError);

      return NextResponse.redirect(
        new URL("/?payment_error=request_not_found", origin)
      );
    }

    const { data: djProfile, error: profileError } =
      await supabaseAdmin
        .from("dj_profiles")
        .select("slug")
        .eq("id", songRequest.dj_profile_id)
        .maybeSingle();

    if (profileError || !djProfile) {
      console.error("DJ profile lookup error:", profileError);

      return NextResponse.redirect(
        new URL("/?payment_error=dj_not_found", origin)
      );
    }

    /*
     * Guarded on "checkout_pending" because the webhook races this
     * redirect to make the same transition — whichever arrives first
     * wins, and the loser must not reset pending_at, or the DJ's
     * response window would silently restart.
     */
    const { error: updateError } = await supabaseAdmin
      .from("song_requests")
      .update({
        request_status: "pending",
        pending_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", requestId)
      .eq("request_status", "checkout_pending");

    if (updateError) {
      console.error("Song request update error:", updateError);

      return NextResponse.redirect(
        new URL("/?payment_error=request_update_failed", origin)
      );
    }

    sendPushToDJ(songRequest.dj_profile_id, {
      title:
        songRequest.request_type === "song_message"
          ? "New Song + Message request"
          : "New song request",
      body: `${songRequest.song_title} by ${songRequest.artist}`,
      url: "/dj/dashboard",
    }).catch((pushError) => {
      console.error("Push notification error:", pushError);
    });

    const confirmationUrl = new URL(
      `/request/${djProfile.slug}/confirmation`,
      origin
    );

    confirmationUrl.searchParams.set("requestId", requestId);

    return NextResponse.redirect(confirmationUrl);
  } catch (error) {
    console.error("Stripe success route error:", error);

    return NextResponse.redirect(
      new URL("/?payment_error=stripe_success_failed", request.url)
    );
  }
}