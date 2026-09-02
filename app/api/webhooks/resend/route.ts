import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { handleResendWebhook } from "@/src/lib/resendWebhook";

/*
 * ── Resend delivery events ────────────────────────────────────────
 *
 * A thin shell. Everything that decides anything lives in
 * src/lib/resendWebhook.ts, so it can be tested against a real database
 * without a running server, and so this file has nothing in it worth
 * getting wrong.
 *
 * The raw body is read with request.text() BEFORE anything parses it,
 * because Svix signs the exact bytes and a re-serialised object will not
 * verify. Same reason and same shape as the Stripe webhook.
 *
 * This endpoint is public, so it fails closed in every direction: no
 * secret, missing headers or a bad signature all refuse before the
 * database is touched.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const outcome = await handleResendWebhook(
    rawBody,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    supabaseAdmin,
    process.env.RESEND_WEBHOOK_SECRET
  );

  /*
   * The body says only what happened to us, never anything about the
   * message or its recipient. Resend needs a status code; it does not
   * need to be told which DJ this was.
   */
  return NextResponse.json({ ok: outcome.status === 200 }, { status: outcome.status });
}
