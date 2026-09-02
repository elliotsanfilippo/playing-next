/*
 * ── The initial onboarding-recovery backlog. R1 only, once. ───────
 *
 * A single-purpose script for a single event: the first send of
 * recovery_1 to the DJs who were already stalled when the feature was
 * built. It is not the scheduler, and there is deliberately no
 * scheduler yet.
 *
 * DRY RUN IS THE DEFAULT. Sending requires --execute, passed
 * deliberately. There is no --force, no --only, no way to name a
 * recipient, and no way to override an exclusion. Every address is
 * resolved from auth.users at send time and none is ever printed.
 *
 * What it cannot do, by construction:
 *
 *   * send recovery_2. The template is pinned to recovery_1 and a DJ
 *     whose verdict says recovery_2 is skipped rather than sent
 *     something else.
 *   * email an internal account, a Ready-to-activate DJ, an opted-out
 *     DJ, or anyone already holding a recovery_1 row. Those are
 *     decided by recoveryVerdict, which is the same rule the scheduler
 *     will use, not a copy of it.
 *   * send twice. claimSend inserts against the unique index first, and
 *     a 23505 means somebody else already owns that send.
 *
 * The eligibility check is done twice on purpose: once to build the
 * plan, and again from a fresh read of that DJ's own rows in the moment
 * before their claim. A DJ who finishes their setup while the script is
 * running must not then be told to finish their setup.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { recoveryVerdict, type RecoveryProfile } from "../src/lib/recoveryEligibility.ts";
import { renderRecoveryEmail } from "../src/lib/recoveryTemplates.ts";
import { claimSend, settleSend } from "../src/lib/lifecycleEmails.ts";
import { sendEmail } from "../src/lib/email.ts";

const EXECUTE = process.argv.includes("--execute");

/* Anything else on the command line is a mistake, and a mistake on a
   script that emails real people should stop rather than be ignored. */
const unknown = process.argv.slice(2).filter((a) => a !== "--execute");
if (unknown.length) {
  console.error(`Unrecognised argument(s): ${unknown.join(", ")}. This script takes --execute or nothing.`);
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "EMAIL_FROM"]) {
  if (!env[key]) {
    console.error(`Missing ${key}. Refusing to run.`);
    process.exit(1);
  }
  process.env[key] = env[key];
}
if (env.EMAIL_REPLY_TO) process.env.EMAIL_REPLY_TO = env.EMAIL_REPLY_TO;

const BASE_URL = "https://playingnextapp.com";
const TEMPLATE = "recovery_1" as const;

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PROFILE_COLUMNS =
  "id, slug, dj_name, request_price, profile_image_url, stripe_connected, stripe_account_id, lifecycle_emails_opted_out, created_at";

async function verdictFor(profile: RecoveryProfile, now: Date) {
  const [{ data: requests }, { data: sends }] = await Promise.all([
    db.from("song_requests").select("request_status, stripe_fee, accepted_at").eq("dj_profile_id", profile.id),
    db
      .from("dj_lifecycle_emails")
      .select("template_key, status, attempts, created_at, sent_at")
      .eq("dj_profile_id", profile.id),
  ]);

  return recoveryVerdict(profile, requests ?? [], sends ?? [], now);
}

async function main() {
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

  console.log(`mode      : ${EXECUTE ? "EXECUTE - real emails will be sent" : "DRY RUN - nothing will be sent"}`);
  console.log(`project   : ${ref}`);
  console.log(`template  : ${TEMPLATE} only`);
  console.log(`sender    : ${env.EMAIL_FROM}`);
  console.log(`reply-to  : ${env.EMAIL_REPLY_TO ?? "(not set)"}`);
  console.log(`started   : ${new Date().toISOString()}\n`);

  const { data: profiles, error } = await db.from("dj_profiles").select(PROFILE_COLUMNS);
  if (error) throw error;

  const planned: RecoveryProfile[] = [];
  const skipped: { slug: string; reason: string }[] = [];

  for (const profile of profiles as RecoveryProfile[]) {
    const verdict = await verdictFor(profile, new Date());

    if (!verdict.eligible) {
      skipped.push({ slug: profile.slug ?? profile.id, reason: verdict.reason });
      continue;
    }

    if (verdict.template !== TEMPLATE) {
      skipped.push({ slug: profile.slug ?? profile.id, reason: `would be ${verdict.template}, out of scope` });
      continue;
    }

    planned.push(profile);
  }

  planned.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  console.log(`===== PLAN: ${planned.length} recipient(s) =====`);

  let sent = 0;
  let failed = 0;
  let abandoned = 0;

  for (const profile of planned) {
    const slug = profile.slug ?? profile.id;

    /* Fresh read, immediately before this DJ's claim. The plan above may
       be seconds old, and seconds are enough for somebody to connect
       Stripe. */
    const { data: current, error: reread } = await db
      .from("dj_profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", profile.id)
      .single();

    if (reread || !current) {
      console.log(`  ${slug.padEnd(20)} SKIP  could not re-read the profile`);
      abandoned++;
      continue;
    }

    const verdict = await verdictFor(current as RecoveryProfile, new Date());

    if (!verdict.eligible || verdict.template !== TEMPLATE) {
      console.log(`  ${slug.padEnd(20)} SKIP  no longer eligible (${verdict.eligible ? verdict.template : verdict.reason})`);
      abandoned++;
      continue;
    }

    const state = verdict.state;

    if (!EXECUTE) {
      /* Render anyway, so the dry run proves the email builds and shows
         which variant and which button each DJ would get. */
      const preview = renderRecoveryEmail({
        profile: current as RecoveryProfile,
        template: TEMPLATE,
        state,
        baseUrl: BASE_URL,
        unsubscribeHref: `${BASE_URL}/api/email/unsubscribe?s=<created-at-claim>`,
        repliesMonitored: Boolean(process.env.EMAIL_REPLY_TO),
      });

      const cta = [...preview.html.matchAll(/text-decoration:none;">([^<]+)<\/a>/g)].map((m) => m[1])[0];

      /* Resolve the address to prove one exists. Never print it. */
      const { data: profileUser } = await db
        .from("dj_profiles")
        .select("user_id")
        .eq("id", current.id)
        .single();
      const auth = profileUser?.user_id
        ? await db.auth.admin.getUserById(profileUser.user_id)
        : null;
      const hasAddress = Boolean(auth?.data?.user?.email);

      console.log(
        `  ${slug.padEnd(20)} ${state}  WOULD CLAIM + SEND  "${preview.subject}"  cta "${cta}"  address ${hasAddress ? "resolved" : "MISSING"}`
      );
      continue;
    }

    /* ---- claim, send, settle ---- */
    const claim = await claimSend(db, current.id, TEMPLATE, state);

    if (!claim.claimed) {
      console.log(`  ${slug.padEnd(20)} SKIP  ${claim.reason}`);
      abandoned++;
      continue;
    }

    const { data: profileUser } = await db
      .from("dj_profiles")
      .select("user_id")
      .eq("id", current.id)
      .single();

    const auth = profileUser?.user_id ? await db.auth.admin.getUserById(profileUser.user_id) : null;
    const to = auth?.data?.user?.email;

    if (!to) {
      await settleSend(db, claim.id, { ok: false });
      console.log(`  ${slug.padEnd(20)} FAIL  no address on the auth user`);
      failed++;
      continue;
    }

    const rendered = renderRecoveryEmail({
      profile: current as RecoveryProfile,
      template: TEMPLATE,
      state,
      baseUrl: BASE_URL,
      unsubscribeHref: `${BASE_URL}/api/email/unsubscribe?s=${claim.id}`,
      repliesMonitored: Boolean(process.env.EMAIL_REPLY_TO),
    });

    const result = await sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: process.env.EMAIL_REPLY_TO,
      headers: {
        "List-Unsubscribe": `<${BASE_URL}/api/email/unsubscribe?s=${claim.id}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    await settleSend(db, claim.id, result.ok ? { ok: true, providerMessageId: result.id } : { ok: false });

    if (result.ok) {
      sent++;
      console.log(`  ${slug.padEnd(20)} ${state}  SENT   ${result.id ?? "(no id)"}`);
    } else {
      failed++;
      console.log(`  ${slug.padEnd(20)} ${state}  FAILED ${result.error}`);
    }

    /* Gentle on the provider, and it keeps the log readable. */
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  console.log(`\n===== NOT ELIGIBLE (${skipped.length}) =====`);
  for (const s of skipped.sort((a, b) => a.reason.localeCompare(b.reason))) {
    console.log(`  ${s.slug.padEnd(20)} ${s.reason}`);
  }

  console.log(
    `\n===== RESULT =====\n  ${
      EXECUTE
        ? `sent ${sent}, failed ${failed}, skipped at send time ${abandoned}`
        : `${planned.length} would be sent. Nothing was sent. Re-run with --execute to send.`
    }`
  );
}

main().catch((error) => {
  console.error("Backlog run failed:", error);
  process.exit(1);
});
