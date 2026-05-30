import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentIntentId } = body;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "Missing payment intent ID" },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    return NextResponse.json(paymentIntent);
  } catch (error) {
    console.log("Stripe cancel error:", error);

    return NextResponse.json(
      {
        error: "Stripe cancel failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}