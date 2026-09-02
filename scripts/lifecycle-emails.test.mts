/*
 * dj_lifecycle_emails, exercised through the real client path.
 *
 * Runs ONLY against the isolated Playing Next Test project, because
 * every assertion below writes. No lifecycle-email row is ever created
 * in Production: Production is verified read-only, by introspection.
 *
 * Cleanup is deliberately NOT possible with these credentials. DELETE is
 * revoked from service_role by design, which is one of the things this
 * file proves, so the rows it creates are removed afterwards with
 * owner-level SQL rather than by the suite.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test, { before } from "node:test";
import { createClient } from "@supabase/supabase-js";

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

/*
 * A fresh synthetic DJ every run. This used to reuse whatever profile it
 * found first, which collided with dj_lifecycle_emails_once the moment
 * any other suite had already written a row for that DJ, and failed for
 * a reason that had nothing to do with the code under test.
 */
before(async () => {
  const { data, error } = await db
    .from("dj_profiles")
    .insert({
      dj_name: "Fixture DJ",
      slug: `fixture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
    .select("id")
    .single();

  if (error) throw error;
  djId = data.id;
});

test("service_role can INSERT a claim", async () => {
  const { data, error } = await db
    .from("dj_lifecycle_emails")
    .insert({ dj_profile_id: djId, template_key: "recovery_1", state_at_send: "A", status: "claimed", attempts: 1 })
    .select("id, status, attempts")
    .single();

  assert.equal(error, null);
  assert.equal(data!.status, "claimed");
  assert.equal(data!.attempts, 1);
});

test("a duplicate claim for the same DJ and template raises 23505", async () => {
  const { error } = await db
    .from("dj_lifecycle_emails")
    .insert({ dj_profile_id: djId, template_key: "recovery_1", state_at_send: "A" });

  assert.equal(error?.code, "23505", `expected 23505, got ${error?.code}`);
});

test("service_role can UPDATE claimed -> sent", async () => {
  const { data, error } = await db
    .from("dj_lifecycle_emails")
    .update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: "synthetic-1" })
    .eq("dj_profile_id", djId)
    .eq("template_key", "recovery_1")
    .select("status, sent_at, provider_message_id")
    .single();

  assert.equal(error, null);
  assert.equal(data!.status, "sent");
  assert.ok(data!.sent_at);
  assert.equal(data!.provider_message_id, "synthetic-1");
});

test("sent -> failed is refused with 23001", async () => {
  const { error } = await db
    .from("dj_lifecycle_emails")
    .update({ status: "failed" })
    .eq("dj_profile_id", djId)
    .eq("template_key", "recovery_1");

  assert.equal(error?.code, "23001", `expected 23001, got ${error?.code}`);
});

test("sent -> claimed is refused with 23001", async () => {
  const { error } = await db
    .from("dj_lifecycle_emails")
    .update({ status: "claimed" })
    .eq("dj_profile_id", djId)
    .eq("template_key", "recovery_1");

  assert.equal(error?.code, "23001", `expected 23001, got ${error?.code}`);
});

test("updating provider_message_id while still sent succeeds", async () => {
  const { data, error } = await db
    .from("dj_lifecycle_emails")
    .update({ provider_message_id: "synthetic-1-corrected" })
    .eq("dj_profile_id", djId)
    .eq("template_key", "recovery_1")
    .select("status, provider_message_id")
    .single();

  assert.equal(error, null, `the trigger must block the transition, not freeze the row`);
  assert.equal(data!.status, "sent");
  assert.equal(data!.provider_message_id, "synthetic-1-corrected");
});

test("service_role cannot DELETE", async () => {
  const { error } = await db
    .from("dj_lifecycle_emails")
    .delete()
    .eq("dj_profile_id", djId)
    .eq("template_key", "recovery_1");

  assert.equal(error?.code, "42501", `expected 42501, got ${error?.code}`);
});

test("the retry CAS: only one of eight concurrent claims wins", async () => {
  await db
    .from("dj_lifecycle_emails")
    .insert({ dj_profile_id: djId, template_key: "recovery_2", state_at_send: "A", status: "failed", attempts: 1, last_error_at: new Date().toISOString() });

  const MAX = 3;
  const claim = () =>
    db
      .from("dj_lifecycle_emails")
      .update({ status: "claimed", attempts: 2, state_at_send: "C" })
      .eq("dj_profile_id", djId)
      .eq("template_key", "recovery_2")
      .eq("status", "failed")
      .eq("attempts", 1)
      .lt("attempts", MAX)
      .select("id");

  const results = await Promise.all(Array.from({ length: 8 }, claim));
  const winners = results.filter((r) => r.data && r.data.length === 1);

  assert.equal(winners.length, 1, `expected exactly one winner, got ${winners.length}`);

  const { data: row } = await db
    .from("dj_lifecycle_emails")
    .select("status, attempts, state_at_send, last_error_at")
    .eq("dj_profile_id", djId)
    .eq("template_key", "recovery_2")
    .single();

  assert.equal(row!.status, "claimed");
  assert.equal(row!.attempts, 2);
  assert.equal(row!.state_at_send, "C", "state_at_send refreshes on retry");
  assert.ok(row!.last_error_at, "last_error_at survives as historical evidence");
});

test("a failed row at the attempt cap is never claimed", async () => {
  await db
    .from("dj_lifecycle_emails")
    .update({ status: "failed", attempts: 3 })
    .eq("dj_profile_id", djId)
    .eq("template_key", "recovery_2");

  const { data } = await db
    .from("dj_lifecycle_emails")
    .update({ status: "claimed", attempts: 4 })
    .eq("dj_profile_id", djId)
    .eq("template_key", "recovery_2")
    .eq("status", "failed")
    .lt("attempts", 3)
    .select("id");

  assert.equal(data?.length ?? 0, 0);
});
