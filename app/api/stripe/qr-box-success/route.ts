import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/src/lib/email";

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
    const orderId = request.nextUrl.searchParams.get("orderId");
    const origin = request.nextUrl.origin;

    if (!sessionId || !orderId) {
      return NextResponse.redirect(new URL("/dj/dashboard", origin));
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.orderId !== orderId) {
      console.error("QR box checkout order ID mismatch", {
        orderId,
        metadataOrderId: session.metadata?.orderId,
      });

      return NextResponse.redirect(
        new URL("/dj/dashboard?qr_box=error", origin)
      );
    }

    if (session.payment_status !== "paid") {
      return NextResponse.redirect(
        new URL("/dj/dashboard?qr_box=error", origin)
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("qr_box_orders")
      .update({
        status: "paid",
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", orderId)
      .eq("status", "pending_payment")
      .select("dj_profile_id, recipient_name, address_line1, address_line2, city, postcode, country")
      .maybeSingle();

    if (orderError) {
      console.error("QR box order update error:", orderError);
    }

    if (order) {
      const { data: djProfile } = await supabaseAdmin
        .from("dj_profiles")
        .update({ qr_box_claimed: true })
        .eq("id", order.dj_profile_id)
        .select("dj_name, slug, user_id")
        .maybeSingle();

      const djEmail = djProfile?.user_id
        ? (await supabaseAdmin.auth.admin.getUserById(djProfile.user_id)).data
            ?.user?.email
        : undefined;
      const addressBlock = [
        order.recipient_name,
        order.address_line1,
        order.address_line2,
        order.city,
        order.postcode,
        order.country,
      ]
        .filter(Boolean)
        .join("<br>");

      if (djEmail) {
        sendEmail({
          to: djEmail,
          subject: "Your QR display block is on its way",
          html: `<p>Thanks for claiming your free QR display block, ${
            djProfile?.dj_name || "there"
          }, we've got your order and it'll ship to:</p><p>${addressBlock}</p>`,
        }).catch((error) => console.error("DJ confirmation email error:", error));
      }

      const opsEmail = process.env.QR_BOX_OPS_EMAIL;

      if (opsEmail) {
        sendEmail({
          to: opsEmail,
          subject: `New QR box order: ${djProfile?.dj_name || order.dj_profile_id}`,
          html: `<p>DJ: ${djProfile?.dj_name || "Unknown"} (${
            djProfile?.slug || order.dj_profile_id
          })</p><p>Ship to:</p><p>${addressBlock}</p>`,
        }).catch((error) => console.error("Ops notification email error:", error));
      }
    }

    return NextResponse.redirect(
      new URL("/dj/dashboard?qr_box=claimed", origin)
    );
  } catch (error) {
    console.error("QR box success route error:", error);

    return NextResponse.redirect(
      new URL("/dj/dashboard?qr_box=error", request.nextUrl.origin)
    );
  }
}
