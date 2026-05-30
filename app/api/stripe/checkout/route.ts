import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { songTitle, artist, requestId, djSlug } = body;

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
              name: `Song request: ${songTitle}`,
              description: artist,
            },
            unit_amount: 500,
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
      success_url: `http://localhost:3000/api/stripe/success?session_id={CHECKOUT_SESSION_ID}&requestId=${requestId}`,
      cancel_url: `http://localhost:3000/request/${safeDjSlug}?cancelled=true`,
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