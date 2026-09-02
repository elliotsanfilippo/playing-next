const RESEND_API_URL = "https://api.resend.com/emails";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  /*
   * Everything below is optional and was added on 2026-09-02 for the
   * lifecycle emails. The two QR box callers pass none of it and behave
   * exactly as they did before.
   */
  /** Where a reply actually goes. Without this, replies hit EMAIL_FROM. */
  replyTo?: string;
  /** The plain-text alternative. Always send one where it matters. */
  text?: string;
  /** Extra headers, e.g. List-Unsubscribe on a lifecycle email. */
  headers?: Record<string, string>;
};

/**
 * What the caller learns about the attempt.
 *
 * Added because a scheduled sender has to know. The QR box emails are
 * fire-and-forget attached to a flow that already succeeded, so ignoring
 * the outcome is right for them; a cron that records "sent" in an
 * append-and-settle table cannot record anything honest without this.
 */
export type EmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; status?: number };

/*
 * No SDK — Resend's send endpoint is a single POST, and pulling in a
 * whole package for one call isn't worth the dependency.
 *
 * Still fails soft rather than throwing: an unconfigured or down email
 * provider should never take down a real flow (a paid order, a webhook)
 * that already succeeded on the parts that matter. The difference now is
 * that the failure is *returned* as well as logged, so a caller that
 * needs to know can ask, and a caller that does not can carry on
 * ignoring it exactly as before.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.error("Email is not configured (missing RESEND_API_KEY or EMAIL_FROM).");

    return { ok: false, error: "Email is not configured." };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        /* Undefined keys are dropped by JSON.stringify, so a caller that
           passes none of the optional fields sends the identical body it
           sent before this change. */
        reply_to: payload.replyTo,
        text: payload.text,
        headers: payload.headers,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Resend email send failed:", response.status, body);

      return { ok: false, error: body, status: response.status };
    }

    /* Resend returns { id }. Treat a missing or unparseable id as a
       success without an id rather than as a failure: the mail has been
       accepted at that point, and claiming otherwise would make a
       scheduled sender retry something that already went out. */
    const data = (await response.json().catch(() => null)) as { id?: string } | null;

    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    console.error("Email send error:", error);

    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
