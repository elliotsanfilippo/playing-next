import { Webhook } from "svix";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * ── Resend delivery webhooks, verified and narrowed ───────────────
 *
 * The logic lives here rather than in the route so it can be tested
 * against a real database without a running Next server. The route is a
 * thin shell over `handleResendWebhook`.
 *
 * Two things this deliberately does NOT do:
 *
 *   * open and click events. Both require tracking we have chosen not to
 *     enable, and neither is in ACCEPTED below, so even if somebody
 *     ticked those boxes in the dashboard tomorrow the handler would
 *     ignore them rather than quietly start recording opens.
 *
 *   * anything with the recipient. The payload carries `data.to`, and it
 *     is never read, never stored and never logged. Nor is any IP or
 *     user agent, which the delivery events do not carry anyway. What
 *     gets written is a state and a timestamp against a row we already
 *     had.
 *
 * Idempotency is not implemented here. It is a property of the database:
 * dj_lifecycle_emails_delivery_forward_only keeps the higher-ranked
 * state, so a duplicate or out-of-order event is absorbed rather than
 * rejected. That is why this writes unconditionally and why a repeat
 * does not need a dedup table.
 */

/** Resend event type to the state we store. Nothing else is processed. */
const ACCEPTED: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delayed",
  "email.failed": "failed",
};

export type WebhookOutcome =
  | { status: 200; result: "recorded" | "ignored_event" | "unmatched" }
  | { status: 400; result: "bad_signature" | "malformed" }
  | { status: 500; result: "not_configured" };

type Headers = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

/**
 * Verify, narrow, and record. Returns what happened rather than throwing,
 * so the route can map outcomes to responses in one place.
 *
 * `rawBody` must be the untouched request body: Svix signs the exact
 * bytes, and a re-serialised object will not verify.
 */
export async function handleResendWebhook(
  rawBody: string,
  headers: Headers,
  db: SupabaseClient,
  secret: string | undefined
): Promise<WebhookOutcome> {
  /*
   * Fails closed. No secret means we cannot tell a real Resend event
   * from anyone who guessed the URL, and this endpoint is public, so the
   * only safe behaviour is to refuse everything.
   */
  if (!secret) {
    console.error("Resend webhook received but RESEND_WEBHOOK_SECRET is not configured.");
    return { status: 500, result: "not_configured" };
  }

  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { status: 400, result: "bad_signature" };
  }

  try {
    /*
     * svix checks the HMAC and the timestamp tolerance. Hand-rolling
     * this was explicitly ruled out: it is a security primitive where a
     * subtle mistake fails open rather than loudly.
     *
     * It VALIDATES and throws. It does not hand back the parsed body in
     * this version, whatever the shape of the API suggests, so the
     * return value is deliberately ignored and the body is parsed below.
     * Reading it as the payload made every correctly signed webhook
     * throw a TypeError, which would have been a 500 and an endless
     * Resend retry loop. Caught by testing it rather than trusting the
     * signature of a function.
     */
    new Webhook(secret).verify(rawBody, {
      "svix-id": headers.id,
      "svix-timestamp": headers.timestamp,
      "svix-signature": headers.signature,
    });
  } catch {
    /* Never log the body or the headers here. A failed verification is
       either noise or an attack, and neither deserves a copy of the
       payload in our logs. */
    return { status: 400, result: "bad_signature" };
  }

  /* Only now, on bytes whose signature we have checked. */
  let payload: {
    type?: unknown;
    created_at?: unknown;
    data?: { email_id?: unknown };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, result: "malformed" };
  }

  const type = typeof payload.type === "string" ? payload.type : "";
  const state = ACCEPTED[type];

  /* Signed, but not an event we act on. Opens and clicks land here. */
  if (!state) return { status: 200, result: "ignored_event" };

  const emailId = payload.data?.email_id;

  if (typeof emailId !== "string" || emailId.length === 0) {
    return { status: 400, result: "malformed" };
  }

  /*
   * The provider's own event time, from inside the signed body. Resend
   * documents the top-level created_at as when the event occurred, as
   * distinct from data.created_at, which is when the email was created.
   * Our receipt time would be wrong by however long a retry took, and is
   * not what anybody means by "Delivered 21:57".
   */
  const at =
    typeof payload.created_at === "string" && !Number.isNaN(Date.parse(payload.created_at))
      ? payload.created_at
      : new Date().toISOString();

  const { data, error } = await db
    .from("dj_lifecycle_emails")
    .update({ delivery_state: state, delivery_state_at: at })
    .eq("provider_message_id", emailId)
    .select("id");

  if (error) {
    /* The message id is ours, not the DJ's, so it is safe to name. */
    console.error("Resend webhook update failed for", emailId, error.message);
    return { status: 200, result: "unmatched" };
  }

  /*
   * No row is the normal case, not an error. The QR box confirmations,
   * the ops notification and every admin test email share this Resend
   * account and have no lifecycle row. Returning anything but success
   * would make Resend retry them for ever.
   */
  return { status: 200, result: data && data.length > 0 ? "recorded" : "unmatched" };
}
