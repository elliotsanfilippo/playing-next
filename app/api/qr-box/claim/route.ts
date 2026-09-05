import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { QR_BOX_SHIPPING_FEE } from "@/src/lib/pricing";

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

type ClaimBody = {
  recipientName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
};

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json(
        { error: "Your session is invalid or has expired." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as ClaimBody;

    const recipientName = body.recipientName?.trim().slice(0, 200);
    const addressLine1 = body.addressLine1?.trim().slice(0, 200);
    const addressLine2 = body.addressLine2?.trim().slice(0, 200) || null;
    const city = body.city?.trim().slice(0, 100);
    const postcode = body.postcode?.trim().slice(0, 20);

    if (!recipientName || !addressLine1 || !city || !postcode) {
      return NextResponse.json(
        { error: "Please fill in your name, address, city, and postcode." },
        { status: 400 }
      );
    }

    const { data: djProfile, error: profileError } = await supabaseAdmin
      .from("dj_profiles")
      .select("id, dj_name, slug, qr_box_eligible, qr_box_claimed, qr_box_dismissed")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !djProfile) {
      return NextResponse.json(
        { error: "No DJ profile was found." },
        { status: 404 }
      );
    }

    if (!djProfile.qr_box_eligible) {
      return NextResponse.json(
        { error: "You're not eligible for a QR box." },
        { status: 409 }
      );
    }

    if (djProfile.qr_box_claimed || djProfile.qr_box_dismissed) {
      return NextResponse.json(
        { error: "This offer has already been actioned on your account." },
        { status: 409 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("qr_box_orders")
      .insert({
        dj_profile_id: djProfile.id,
        recipient_name: recipientName,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        postcode,
        country: "GB",
        shipping_amount: QR_BOX_SHIPPING_FEE,
        status: "pending_payment",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("QR box order create error:", orderError);

      return NextResponse.json(
        { error: "Unable to create your order." },
        { status: 500 }
      );
    }

    const origin = request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "QR Display Block: Shipping",
              description: `For ${djProfile.dj_name}`,
            },
            unit_amount: QR_BOX_SHIPPING_FEE,
          },
          quantity: 1,
        },
      ],

      metadata: {
        orderId: order.id,
        djProfileId: djProfile.id,
      },

      success_url:
        `${origin}/api/stripe/qr-box-success` +
        `?session_id={CHECKOUT_SESSION_ID}` +
        `&orderId=${encodeURIComponent(order.id)}`,

      cancel_url: `${origin}/dj/dashboard`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Unable to start checkout." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("QR box claim route error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
