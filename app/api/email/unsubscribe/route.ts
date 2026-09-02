import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/*
 * ── Stopping setup reminders ──────────────────────────────────────
 *
 * Category scoped, and only this category. Setting the flag suppresses
 * onboarding-recovery email and nothing else: password resets and email
 * verification are sent by Supabase Auth from its own system and cannot
 * see this column, and QR box order confirmations do not read it. Those
 * are transactional and are not consentable in the same way, so an
 * opt-out here must never reach them.
 *
 * The capability is the send's own row id
 * ---------------------------------------
 * The link carries dj_lifecycle_emails.id, a random v4 UUID created at
 * claim time. It is unguessable, it is scoped to one send, and it maps
 * to exactly one profile. That is the same shape as a password-reset
 * link and it needs no new secret to sign, no new column to store, and
 * no email address in the URL.
 *
 * GET never changes anything
 * --------------------------
 * Mail clients and security scanners fetch links in messages. A GET that
 * opted somebody out would let a link scanner unsubscribe a DJ who never
 * clicked. So GET renders a confirmation with a button, and POST does
 * the work. One-click unsubscribe (RFC 8058) is also a POST, which is
 * why the header pair in the email is List-Unsubscribe plus
 * List-Unsubscribe-Post: the client posts here directly and the DJ never
 * sees this page at all.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const page = (title: string, body: string, showButton: string | null) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;background:#08090a;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:420px;margin:0 auto;padding:64px 24px;">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9a9aa2;font-weight:600;">Playing Next</div>
  <h1 style="font-size:24px;line-height:30px;margin:18px 0 12px;">${title}</h1>
  <p style="font-size:15px;line-height:22px;color:#9a9aa2;margin:0 0 24px;">${body}</p>
  ${
    showButton
      ? `<form method="post" action="${showButton}">
           <button type="submit" style="width:100%;padding:14px 20px;border:0;border-radius:9px;
             background:#4ade80;color:#06210f;font-size:15px;font-weight:700;cursor:pointer;">
             Stop setup reminders</button>
         </form>`
      : ""
  }
</div></body></html>`;

const html = (markup: string, status = 200) =>
  new NextResponse(markup, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });

async function profileForSend(sendId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(sendId)) return null;

  const { data } = await supabaseAdmin
    .from("dj_lifecycle_emails")
    .select("dj_profile_id")
    .eq("id", sendId)
    .maybeSingle();

  return data?.dj_profile_id ?? null;
}

export async function GET(request: NextRequest) {
  const sendId = request.nextUrl.searchParams.get("s") ?? "";
  const djProfileId = await profileForSend(sendId);

  if (!djProfileId) {
    return html(
      page(
        "This link is no longer valid",
        "It may have already been used, or it came from a test message. Nothing has changed.",
        null
      ),
      404
    );
  }

  return html(
    page(
      "Stop setup reminders?",
      "You will not receive any more emails about finishing your Playing Next setup. Your account stays exactly as it is, and you will still get anything about your payments, your orders and your account security.",
      `/api/email/unsubscribe?s=${encodeURIComponent(sendId)}`
    )
  );
}

export async function POST(request: NextRequest) {
  const sendId = request.nextUrl.searchParams.get("s") ?? "";
  const djProfileId = await profileForSend(sendId);

  if (!djProfileId) {
    return html(page("This link is no longer valid", "Nothing has changed.", null), 404);
  }

  const { error } = await supabaseAdmin
    .from("dj_profiles")
    .update({ lifecycle_emails_opted_out: true })
    .eq("id", djProfileId);

  if (error) {
    console.error("Lifecycle email opt-out failed:", error.message);

    return html(
      page(
        "We could not save that",
        "Something went wrong at our end and your preference was not saved. Please try again, or reply to the email and we will do it by hand.",
        `/api/email/unsubscribe?s=${encodeURIComponent(sendId)}`
      ),
      500
    );
  }

  return html(
    page(
      "Done, no more setup reminders",
      "We will not email you about finishing your setup again. Everything else about your account is unchanged, and your page is still there whenever you want it.",
      null
    )
  );
}
