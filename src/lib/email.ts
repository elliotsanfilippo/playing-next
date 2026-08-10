const RESEND_API_URL = "https://api.resend.com/emails";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

/*
 * No SDK — Resend's send endpoint is a single POST, and pulling in a
 * whole package for one call isn't worth the dependency.
 *
 * Fails soft rather than throwing: an unconfigured or down email
 * provider should never take down a real flow (a paid order, a
 * webhook) that already succeeded on the parts that matter.
 */
export async function sendEmail(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.error("Email is not configured (missing RESEND_API_KEY or EMAIL_FROM).");
    return;
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
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Resend email send failed:", response.status, body);
    }
  } catch (error) {
    console.error("Email send error:", error);
  }
}
