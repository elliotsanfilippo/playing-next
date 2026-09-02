/*
 * The Resend delivery webhook, end to end against Playing Next Test.
 *
 * Signatures are real: each test signs its payload with svix using a
 * test secret, so verification is exercised rather than stubbed. Nothing
 * here sends an email; the handler only ever reads a signed body and
 * writes a state.
 *
 * Runs ONLY against the isolated test project and refuses to start if
 * the URL resolves to Production.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test, { before } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";
import { handleResendWebhook } from "../src/lib/resendWebhook.ts";

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

/* A syntactically valid Svix secret. Never a real one. */
const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

/** Signs a payload the way Resend does, so verification is real. */
const signed = (body: unknown) => {
  const raw = JSON.stringify(body);
  const id = `msg_${Math.random().toString(36).slice(2, 12)}`;
  const timestamp = new Date();
  const signature = new Webhook(SECRET).sign(id, timestamp, raw);

  return {
    raw,
    headers: {
      id,
      timestamp: Math.floor(timestamp.getTime() / 1000).toString(),
      signature,
    },
  };
};

const event = (type: string, emailId: string, createdAt: string) => ({
  type,
  created_at: createdAt,
  data: {
    email_id: emailId,
    created_at: "2026-09-02T20:57:45.000Z",
    /* Present in the real payload, and deliberately never read. */
    to: ["someone@example.invalid"],
    from: "Playing Next <info@playingnextapp.com>",
    subject: "Two steps from your first paid request",
    message_id: "<test@eu-west-1.amazonses.com>",
  },
});

/*
 * secret is required rather than defaulted. It was optional with a
 * default, so passing undefined explicitly - which is exactly what the
 * missing-secret test does - silently substituted the real secret and
 * the test proved nothing.
 */
const send = (body: unknown, secret: string | undefined) => {
  const { raw, headers } = signed(body);
  return handleResendWebhook(raw, headers, db, secret);
};

const sendSigned = (body: unknown) => send(body, SECRET);

let messageId: string;
let rowId: string;

const seed = async () => {
  const { data: dj } = await db
    .from("dj_profiles")
    .insert({ dj_name: "New DJ", slug: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })
    .select("id")
    .single();

  const id = `resend_${Math.random().toString(36).slice(2, 14)}`;

  const { data: row } = await db
    .from("dj_lifecycle_emails")
    .insert({
      dj_profile_id: dj!.id,
      template_key: "recovery_1",
      state_at_send: "A",
      status: "sent",
      sent_at: "2026-09-02T20:57:45.000Z",
      provider_message_id: id,
      subject_at_send: "Two steps from your first paid request",
    })
    .select("id")
    .single();

  return { messageId: id, rowId: row!.id };
};

const readRow = async (id: string) => {
  const { data } = await db
    .from("dj_lifecycle_emails")
    .select("delivery_state, delivery_state_at")
    .eq("id", id)
    .single();
  return data!;
};

before(async () => {
  ({ messageId, rowId } = await seed());
});

/* ── security ─────────────────────────────────────────────────── */

test("a missing secret fails closed and touches nothing", async () => {
  const outcome = await send(event("email.delivered", messageId, "2026-09-02T20:57:47.000Z"), undefined);

  assert.equal(outcome.status, 500);
  assert.equal(outcome.result, "not_configured");
  assert.equal((await readRow(rowId)).delivery_state, null, "nothing was written");
});

test("an invalid signature is refused", async () => {
  const { raw, headers } = signed(event("email.delivered", messageId, "2026-09-02T20:57:47.000Z"));
  const outcome = await handleResendWebhook(
    raw,
    { ...headers, signature: "v1,ZGVmaW5pdGVseSBub3QgYSByZWFsIHNpZ25hdHVyZQ==" },
    db,
    SECRET
  );

  assert.equal(outcome.status, 400);
  assert.equal(outcome.result, "bad_signature");
  assert.equal((await readRow(rowId)).delivery_state, null);
});

test("a tampered body is refused, because the signature covers the bytes", async () => {
  const { headers } = signed(event("email.delivered", messageId, "2026-09-02T20:57:47.000Z"));
  const tampered = JSON.stringify(event("email.delivered", "someone-elses-id", "2026-09-02T20:57:47.000Z"));

  const outcome = await handleResendWebhook(tampered, headers, db, SECRET);

  assert.equal(outcome.status, 400);
  assert.equal(outcome.result, "bad_signature");
});

test("missing svix headers are refused", async () => {
  const { raw } = signed(event("email.delivered", messageId, "2026-09-02T20:57:47.000Z"));

  for (const missing of ["id", "timestamp", "signature"] as const) {
    const headers = { id: "msg_x", timestamp: "1", signature: "v1,x" };
    headers[missing] = null as never;

    const outcome = await handleResendWebhook(raw, headers, db, SECRET);
    assert.equal(outcome.status, 400, `missing ${missing} should be refused`);
  }
});

/* ── narrowing ────────────────────────────────────────────────── */

test("open and click events are ignored even when correctly signed", async () => {
  for (const type of ["email.opened", "email.clicked"]) {
    const outcome = await sendSigned(event(type, messageId, "2026-09-02T21:00:00.000Z"));

    assert.equal(outcome.status, 200);
    assert.equal(outcome.result, "ignored_event", `${type} must not be recorded`);
  }

  assert.equal((await readRow(rowId)).delivery_state, null, "still nothing recorded");
});

test("an unmatched message id is a silent success", async () => {
  const outcome = await sendSigned(event("email.delivered", "resend_not_ours", "2026-09-02T21:00:00.000Z"));

  assert.equal(outcome.status, 200);
  assert.equal(outcome.result, "unmatched");
});

/* ── recording and precedence ─────────────────────────────────── */

test("delivered is recorded at the provider's event time", async () => {
  const at = "2026-09-02T20:57:47.000Z";
  const outcome = await sendSigned(event("email.delivered", messageId, at));

  assert.equal(outcome.result, "recorded");

  const row = await readRow(rowId);
  assert.equal(row.delivery_state, "delivered");
  assert.equal(new Date(row.delivery_state_at!).toISOString(), at, "provider time, not receipt time");
});

test("a duplicate delivered changes nothing", async () => {
  await sendSigned(event("email.delivered", messageId, "2026-09-02T23:59:00.000Z"));

  const row = await readRow(rowId);
  assert.equal(new Date(row.delivery_state_at!).toISOString(), "2026-09-02T20:57:47.000Z");
});

test("delayed arriving after delivered cannot walk it backwards", async () => {
  await sendSigned(event("email.delivery_delayed", messageId, "2026-09-02T20:57:46.000Z"));

  assert.equal((await readRow(rowId)).delivery_state, "delivered");
});

test("delayed then delivered advances, on a fresh message", async () => {
  const fresh = await seed();

  await sendSigned(event("email.delivery_delayed", fresh.messageId, "2026-09-02T20:00:00.000Z"));
  assert.equal((await readRow(fresh.rowId)).delivery_state, "delayed");

  await sendSigned(event("email.delivered", fresh.messageId, "2026-09-02T20:05:00.000Z"));
  const row = await readRow(fresh.rowId);
  assert.equal(row.delivery_state, "delivered");
  assert.equal(new Date(row.delivery_state_at!).toISOString(), "2026-09-02T20:05:00.000Z");
});

test("complained outranks delivered", async () => {
  await sendSigned(event("email.complained", messageId, "2026-09-03T08:00:00.000Z"));

  const row = await readRow(rowId);
  assert.equal(row.delivery_state, "complained");
  assert.equal(new Date(row.delivery_state_at!).toISOString(), "2026-09-03T08:00:00.000Z");
});

test("a weaker event after a complaint is absorbed", async () => {
  await sendSigned(event("email.delivered", messageId, "2026-09-03T09:00:00.000Z"));

  assert.equal((await readRow(rowId)).delivery_state, "complained");
});

test("bounced and failed record on their own messages", async () => {
  for (const [type, expected] of [
    ["email.bounced", "bounced"],
    ["email.failed", "failed"],
  ] as const) {
    const fresh = await seed();
    const outcome = await sendSigned(event(type, fresh.messageId, "2026-09-02T21:00:00.000Z"));

    assert.equal(outcome.result, "recorded");
    assert.equal((await readRow(fresh.rowId)).delivery_state, expected);
  }
});

/* ── privacy ──────────────────────────────────────────────────── */

test("nothing about the recipient is persisted", async () => {
  const fresh = await seed();

  await sendSigned({
    type: "email.delivered",
    created_at: "2026-09-02T21:00:00.000Z",
    data: {
      email_id: fresh.messageId,
      to: ["a.real.person@example.invalid"],
      from: "Playing Next <info@playingnextapp.com>",
      subject: "Two steps from your first paid request",
      /* Not part of a delivery payload, but included to prove that even
         if it were, nothing here would copy it into the row. */
      ipAddress: "203.0.113.9",
      userAgent: "Mozilla/5.0 (probe)",
    },
  });

  const { data } = await db
    .from("dj_lifecycle_emails")
    .select("*")
    .eq("id", fresh.rowId)
    .single();

  const serialised = JSON.stringify(data);

  for (const leak of ["a.real.person", "example.invalid", "203.0.113.9", "Mozilla"]) {
    assert.ok(!serialised.includes(leak), `${leak} must not be persisted`);
  }

  assert.equal(data!.delivery_state, "delivered", "and the state was still recorded");
});
