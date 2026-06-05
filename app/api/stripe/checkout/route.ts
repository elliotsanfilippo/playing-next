import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("CHECKOUT BODY:", body);
    const {
  songTitle,
  artist,
  requestId,
  djSlug,
  requestType,
  requestPrice,
} = body;

    const safeDjSlug = djSlug || "dj-elliot";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      payment_intent_data: {
        capture_method: "manual",
      },
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name:
  requestType === "song_message"
    ? `Song + Message: ${songTitle}`
    : `Song request: ${songTitle}`,
              description: artist,
            },
            unit_amount: requestPrice || 500,
          },
          quantity: 1,
        },
      ],
      metadata: {
        requestId,
        songTitle,
        artist,
        djSlug: safeDjSlug,
      },
      success_url: `https://playing-next.vercel.app`,
      cancel_url: `https://playing-next.vercel.app`
    });

    return NextResponse.json({
      url: session.url,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null,
    });
  } catch (error) {
    console.log("Stripe checkout error:", error);

    return NextResponse.json(
      {
        error: "Stripe checkout failed",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}