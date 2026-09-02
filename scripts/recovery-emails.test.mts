/*
 * Onboarding-recovery rules, copy and claim logic.
 *
 * Parts one and two are pure and need no database. Part three writes,
 * and therefore runs ONLY against the isolated Playing Next Test
 * project. Nothing here sends an email: the templates are rendered and
 * inspected, never posted anywhere.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test, { before } from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  MAX_EMAIL_ATTEMPTS,
  R1_DAY,
  R2_DAY,
  nextStepHref,
  outstanding,
  recoveryState,
  recoveryVerdict,
  type PriorSend,
  type RecoveryProfile,
} from "../src/lib/recoveryEligibility.ts";
import { renderRecoveryEmail } from "../src/lib/recoveryTemplates.ts";

const NOW = new Date("2026-09-02T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const base: RecoveryProfile = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "test-dj",
  dj_name: "New DJ",
  request_price: 500,
  profile_image_url: null,
  stripe_connected: false,
  stripe_account_id: null,
  lifecycle_emails_opted_out: false,
  created_at: daysAgo(20),
};

const withFields = (patch: Partial<RecoveryProfile>): RecoveryProfile => ({ ...base, ...patch });

const complete = { dj_name: "Real Name", profile_image_url: "https://x.invalid/p.jpg" };

/* ── 1. state ─────────────────────────────────────────────────── */

test("state A is nothing done", () => {
  assert.equal(recoveryState(base), "A");
});

test("state B is profile done, payouts missing", () => {
  assert.equal(recoveryState(withFields(complete)), "B");
});

test("state C is payouts done, profile missing", () => {
  assert.equal(recoveryState(withFields({ stripe_connected: true })), "C");
});

test("ready is both, and is never emailed", () => {
  const p = withFields({ ...complete, stripe_connected: true });
  assert.equal(recoveryState(p), "ready");
  assert.equal(recoveryVerdict(p, [], [], NOW).eligible, false);
});

test("the stored onboarding flag is not consulted anywhere", () => {
  /* A DJ whose profile fields are all set but whose payouts are not is
     state B, even though onboarding_complete would be false for them,
     because that flag includes Stripe and cannot express this. */
  assert.equal(recoveryState(withFields(complete)), "B");
});

test("outstanding lists only what is genuinely missing", () => {
  assert.deepEqual(outstanding(base), ["name", "photo", "payouts"]);
  assert.deepEqual(outstanding(withFields(complete)), ["payouts"]);
  assert.deepEqual(outstanding(withFields({ stripe_connected: true })), ["name", "photo"]);
  assert.deepEqual(outstanding(withFields({ ...complete, stripe_connected: true })), []);
});

test("the CTA goes to the exact outstanding step, never the homepage", () => {
  assert.equal(nextStepHref(base), "/dj/settings?from=onboarding");
  assert.equal(nextStepHref(withFields(complete)), "/dj/settings/payments?from=onboarding");
});

/* ── 2. eligibility ───────────────────────────────────────────── */

test("nobody is emailed before day 3", () => {
  const p = withFields({ created_at: daysAgo(R1_DAY - 1) });
  assert.equal(recoveryVerdict(p, [], [], NOW).eligible, false);
});

test("R1 becomes due on day 3", () => {
  const p = withFields({ created_at: daysAgo(R1_DAY) });
  const v = recoveryVerdict(p, [], [], NOW);
  assert.equal(v.eligible, true);
  assert.equal(v.eligible && v.template, "recovery_1");
});

test("internal accounts are never emailed", () => {
  const p = withFields({ slug: "elliot" });
  assert.equal(recoveryVerdict(p, [], [], NOW).eligible, false);
});

test("an opted-out DJ is never emailed", () => {
  const p = withFields({ lifecycle_emails_opted_out: true });
  assert.equal(recoveryVerdict(p, [], [], NOW).eligible, false);
});

test("an activated DJ is never emailed, whatever their profile says", () => {
  const v = recoveryVerdict(
    base,
    [{ request_status: "played", stripe_fee: 42, accepted_at: daysAgo(1) }],
    [],
    NOW
  );
  assert.equal(v.eligible, false);
  assert.equal(v.eligible === false && v.reason, "already activated");
});

const sentR1 = (days: number): PriorSend => ({
  template_key: "recovery_1",
  status: "sent",
  attempts: 1,
  created_at: daysAgo(days),
  sent_at: daysAgo(days),
});

test("R2 waits for day 10", () => {
  const p = withFields({ created_at: daysAgo(9) });
  assert.equal(recoveryVerdict(p, [], [sentR1(6)], NOW).eligible, false);
});

test("R2 also waits at least six days after R1", () => {
  const p = withFields({ created_at: daysAgo(20) });
  assert.equal(recoveryVerdict(p, [], [sentR1(3)], NOW).eligible, false);

  const v = recoveryVerdict(p, [], [sentR1(7)], NOW);
  assert.equal(v.eligible, true);
  assert.equal(v.eligible && v.template, "recovery_2");
});

test("there is no third reminder", () => {
  const p = withFields({ created_at: daysAgo(60) });
  const history: PriorSend[] = [
    sentR1(50),
    { template_key: "recovery_2", status: "sent", attempts: 1, created_at: daysAgo(40), sent_at: daysAgo(40) },
  ];
  assert.equal(recoveryVerdict(p, [], history, NOW).eligible, false);
});

test("a claimed row is never retried, because its outcome is unknown", () => {
  const history: PriorSend[] = [
    { template_key: "recovery_1", status: "claimed", attempts: 1, created_at: daysAgo(5), sent_at: null },
  ];
  const v = recoveryVerdict(base, [], history, NOW);
  assert.equal(v.eligible, false);
  assert.equal(v.eligible === false && v.reason, "first reminder delivery uncertain");
});

test("a known failure is retried, up to the cap", () => {
  const failed = (attempts: number): PriorSend[] => [
    { template_key: "recovery_1", status: "failed", attempts, created_at: daysAgo(5), sent_at: null },
  ];
  assert.equal(recoveryVerdict(base, [], failed(1), NOW).eligible, true);
  assert.equal(recoveryVerdict(base, [], failed(MAX_EMAIL_ATTEMPTS), NOW).eligible, false);
});

/* ── 3. copy ──────────────────────────────────────────────────── */

const render = (profile: RecoveryProfile, template: "recovery_1" | "recovery_2") =>
  renderRecoveryEmail({
    profile,
    template,
    state: recoveryState(profile) as "A" | "B" | "C",
    baseUrl: "https://playingnextapp.com",
    unsubscribeHref: "https://playingnextapp.com/api/email/unsubscribe?s=x",
    repliesMonitored: true,
  });

const everyVariant = () => {
  const out: { label: string; html: string; text: string; subject: string }[] = [];
  for (const [label, profile] of [
    ["A", base],
    ["B", withFields(complete)],
    ["C", withFields({ stripe_connected: true })],
  ] as const) {
    for (const template of ["recovery_1", "recovery_2"] as const) {
      out.push({ label: `${template} ${label}`, ...render(profile, template) });
    }
  }
  return out;
};

test("state C is never told to connect Stripe again", () => {
  for (const template of ["recovery_1", "recovery_2"] as const) {
    const { html, text } = render(withFields({ stripe_connected: true }), template);
    assert.ok(!html.includes("Connect payouts"), `${template} told a connected DJ to connect`);
    assert.ok(!text.includes("Connect payouts"));
    assert.ok(html.includes("Payouts connected"));
  }
});

test("state B is never told to finish a profile it has finished", () => {
  for (const template of ["recovery_1", "recovery_2"] as const) {
    const { html } = render(withFields(complete), template);
    assert.ok(!html.includes("Add your DJ"), `${template} told a finished profile to add a name`);
    assert.ok(html.includes("Profile finished"));
  }
});

test("no variant promises how long anything takes", () => {
  for (const v of everyVariant()) {
    for (const claim of ["minute", "minutes", "seconds", "takes about", "quick"]) {
      assert.ok(
        !v.html.toLowerCase().includes(claim) && !v.text.toLowerCase().includes(claim),
        `${v.label} contains an unverified time claim: ${claim}`
      );
    }
  }
});

test("no variant uses an em or en dash, an emoji, or the phrase complete onboarding", () => {
  for (const v of everyVariant()) {
    assert.ok(!/[–—]/.test(v.html), `${v.label} contains a dash`);
    assert.ok(!/[–—]/.test(v.subject), `${v.label} subject contains a dash`);
    assert.ok(
      !/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u.test(v.text),
      `${v.label} contains an emoji`
    );
    assert.ok(!v.text.toLowerCase().includes("complete your onboarding"), v.label);
  }
});

test("the QR code is a reward, never a task", () => {
  const { text } = render(base, "recovery_1");
  assert.ok(text.includes("Your QR code is ready and waiting"));
  assert.ok(!text.includes("Get your QR code"));
});

test("every variant carries a plain-text alternative and an unsubscribe link", () => {
  for (const v of everyVariant()) {
    assert.ok(v.text.length > 200, `${v.label} has no real text part`);
    assert.ok(v.text.includes("Stop setup reminders"), v.label);
    assert.ok(v.html.includes("unsubscribe"), v.label);
  }
});

test("the CTA is state-aware and specific", () => {
  assert.ok(render(base, "recovery_1").html.includes("Continue setup"));
  assert.ok(render(withFields(complete), "recovery_1").html.includes("Finish connecting payouts"));
  assert.ok(render(withFields({ stripe_connected: true }), "recovery_1").html.includes("Finish your profile"));
});

test("a repeated CTA is the same action, never a competing one", () => {
  for (const v of everyVariant()) {
    const hrefs = [...v.html.matchAll(/href="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((h) => h.includes("/dj/"));
    const labels = [...v.html.matchAll(/text-decoration:none;">([^<]+)<\/a>/g)].map((m) => m[1]);

    assert.ok(hrefs.length >= 1, `${v.label} has no CTA`);
    assert.equal(new Set(hrefs).size, 1, `${v.label} has competing destinations`);
    assert.equal(new Set(labels).size, 1, `${v.label} has competing labels`);
  }
});

test("R1 repeats the CTA, R2 does not", () => {
  const count = (html: string) => [...html.matchAll(/\/dj\/settings/g)].length;
  assert.equal(count(render(base, "recovery_1").html), 2);
  assert.equal(count(render(base, "recovery_2").html), 1);
});

test("the header uses the real logo asset, not a reconstruction", () => {
  const { html } = render(base, "recovery_1");
  assert.ok(html.includes("/icons/icon-192.png"), "should use the shipped mark");
  assert.ok(html.includes('alt="Playing Next"'), "needs alt text for blocked images");
  assert.ok(!html.includes("border-radius:4px;\n"), "the old dot treatment is gone");
});

test("the CTA appears before the journey", () => {
  const { html } = render(base, "recovery_1");
  assert.ok(html.indexOf("Continue setup") < html.indexOf("Account created"));
});

test("the price shown is the DJ's real price", () => {
  const { text } = render(withFields({ request_price: 300 }), "recovery_1");
  assert.ok(text.includes("£3"), "should quote the real price");
  assert.ok(!text.includes("£5"));
});

/* ── 4. claim, settle and retry, against the test project ─────── */

const parse = (f: string) =>
  Object.fromEntries(
    readFileSync(f, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );

const testEnv = parse(".env.test.local");
const prodEnv = parse(".env.local");
const ref = (u: string) => new URL(u).hostname.split(".")[0];
const url = (testEnv.TEST_SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "");

if (!url || ref(url) === ref(prodEnv.NEXT_PUBLIC_SUPABASE_URL!)) {
  throw new Error("Refusing to run: the test URL is missing or resolves to Production.");
}

const db = createClient(url, testEnv.TEST_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let djId: string;

before(async () => {
  const { data } = await db.from("dj_profiles").select("id").limit(1).maybeSingle();
  if (data) {
    djId = data.id;
    return;
  }
  const { data: made, error } = await db
    .from("dj_profiles")
    .insert({ dj_name: "Fixture DJ", slug: `fixture-${Date.now()}` })
    .select("id")
    .single();
  if (error) throw error;
  djId = made.id;
});

test("claim, settle to sent, and refuse to claim again", async () => {
  const { claimSend, settleSend } = await import("../src/lib/lifecycleEmails.ts");

  const first = await claimSend(db, djId, "recovery_1", "A");
  assert.equal(first.claimed, true);
  assert.equal(first.claimed && first.attempts, 1);

  await settleSend(db, (first as { id: string }).id, { ok: true, providerMessageId: "synthetic" });

  const second = await claimSend(db, djId, "recovery_1", "A");
  assert.equal(second.claimed, false);
  assert.equal(second.claimed === false && second.reason, "already sent");
});

test("a failed claim retries, increments attempts and refreshes the state", async () => {
  const { claimSend, settleSend } = await import("../src/lib/lifecycleEmails.ts");

  const first = await claimSend(db, djId, "recovery_2", "A");
  assert.equal(first.claimed, true);

  await settleSend(db, (first as { id: string }).id, { ok: false });

  const retry = await claimSend(db, djId, "recovery_2", "C");
  assert.equal(retry.claimed, true);
  assert.equal(retry.claimed && retry.attempts, 2);

  const { data } = await db
    .from("dj_lifecycle_emails")
    .select("attempts, state_at_send, last_error_at, status")
    .eq("dj_profile_id", djId)
    .eq("template_key", "recovery_2")
    .single();

  assert.equal(data!.attempts, 2);
  assert.equal(data!.state_at_send, "C", "state refreshes on retry");
  assert.ok(data!.last_error_at, "the earlier failure stays as evidence");
  assert.equal(data!.status, "claimed");
});

test("a claimed row is not claimed again", async () => {
  const { claimSend } = await import("../src/lib/lifecycleEmails.ts");

  const again = await claimSend(db, djId, "recovery_2", "A");
  assert.equal(again.claimed, false);
  assert.equal(again.claimed === false && again.reason, "delivery uncertain");
});
