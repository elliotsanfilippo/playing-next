import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, badRequest, serverError } from "@/src/lib/adminApi";
import { sendEmail } from "@/src/lib/email";
import { renderRecoveryEmail } from "@/src/lib/recoveryTemplates";
import type { RecoveryProfile, RecoveryTemplate } from "@/src/lib/recoveryEligibility";

/*
 * ── One test email, to the admin who asked for it ─────────────────
 *
 * Exists so the real thing can be looked at in a real mail client
 * before any DJ receives anything. It renders through the production
 * template and sends through the production Resend path, because a test
 * that uses a different renderer or a different transport proves nothing
 * about what a DJ would actually get.
 *
 * Four properties, each deliberate:
 *
 *   1. The recipient is NOT a parameter. It comes from the verified
 *      admin session, the same source the erasure route uses for
 *      performed_by. There is no request field that can redirect this
 *      anywhere, so the route is structurally incapable of emailing a
 *      DJ, a guest, or an attacker's address.
 *
 *   2. It writes no dj_lifecycle_emails row. A test must never consume
 *      an idempotency slot: the unique index would then treat the real
 *      first send to that DJ as a duplicate and skip it silently, and
 *      the DJ would never hear from us at all.
 *
 *   3. It touches no DJ profile. The profile below is synthetic, built
 *      from the variant asked for, so nothing real is read or written.
 *
 *   4. It reports the provider result rather than swallowing it. This is
 *      the one place where sendEmail's fail-soft behaviour is wrong: the
 *      entire point is to learn whether the send worked.
 *
 * The unsubscribe link is rendered as a real link to the real route and
 * is expected to be inert, because there is no send row behind it. That
 * route answers "this link is no longer valid" and changes nothing,
 * which is the correct behaviour for a test message.
 */

const VARIANTS: Record<string, Partial<RecoveryProfile>> = {
  /* Nothing done, Stripe started and abandoned. The commonest real case. */
  A: {
    dj_name: "New DJ",
    profile_image_url: null,
    stripe_connected: false,
    stripe_account_id: "acct_synthetic",
  },
  /* Profile finished, payouts outstanding. */
  B: {
    dj_name: "Test DJ",
    profile_image_url: "https://example.invalid/photo.jpg",
    stripe_connected: false,
    stripe_account_id: "acct_synthetic",
  },
  /* Payouts connected, profile outstanding. */
  C: {
    dj_name: "New DJ",
    profile_image_url: null,
    stripe_connected: true,
    stripe_account_id: "acct_synthetic",
  },
};

export async function POST(request: NextRequest) {
  const { denied, user } = await requireAdminUser(request);
  if (denied) return denied;

  let body: { template?: string; state?: string };

  try {
    body = await request.json();
  } catch {
    return badRequest("Expected a JSON body naming the template and state.");
  }

  const template = body.template === "recovery_2" ? "recovery_2" : "recovery_1";
  const state = String(body.state ?? "A").toUpperCase();

  if (!(state in VARIANTS)) {
    return badRequest("State must be one of A, B or C.");
  }

  /* The recipient, and the only recipient. Never from the body. */
  const to = user.email;

  if (!to) {
    return serverError("Admin test email", new Error("The admin session carries no email."));
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playingnextapp.com";
  const replyTo = process.env.EMAIL_REPLY_TO;

  const profile: RecoveryProfile = {
    id: "00000000-0000-0000-0000-000000000000",
    slug: "your-dj-name",
    request_price: 500,
    created_at: new Date().toISOString(),
    lifecycle_emails_opted_out: false,
    dj_name: null,
    profile_image_url: null,
    stripe_connected: false,
    stripe_account_id: null,
    ...VARIANTS[state],
  };

  const rendered = renderRecoveryEmail({
    profile,
    template: template as RecoveryTemplate,
    state: state as "A" | "B" | "C",
    baseUrl,
    /* Deliberately carries no send id, so the route it points at will
       answer "no longer valid" and change nothing. */
    unsubscribeHref: `${baseUrl}/api/email/unsubscribe?s=test`,
    repliesMonitored: Boolean(replyTo),
  });

  const result = await sendEmail({
    to,
    subject: `[TEST] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
    replyTo,
    headers: {
      "List-Unsubscribe": `<${baseUrl}/api/email/unsubscribe?s=test>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  /* The response never echoes the recipient. Whoever called this route
     is the recipient and already knows; anything else that reads a log
     does not need it. */
  return NextResponse.json(
    {
      sent: result.ok,
      template,
      state,
      subject: `[TEST] ${rendered.subject}`,
      providerMessageId: result.ok ? result.id : null,
      error: result.ok ? null : result.error,
      wroteDeliveryRow: false,
      repliesMonitored: Boolean(replyTo),
    },
    { status: result.ok ? 200 : 502 }
  );
}
