/*
 * The two pending migrations, exercised against Playing Next Test.
 *
 * Everything here writes, so it runs ONLY against the isolated test
 * project and refuses to start if the URL resolves to Production. Rows
 * are removed afterwards with owner SQL, because service_role cannot
 * delete from dj_lifecycle_emails by design.
 *
 * Three things are under test:
 *   1. delivery_state only ever moves forward, whatever order the
 *      webhooks arrive in and however many times they repeat.
 *   2. subject_at_send survives as written.
 *   3. profile_completed_at stamps once, from the same rule the product
 *      uses, and is never invented for a profile that was already
 *      complete.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test, { before } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { profileComplete, type RecoveryProfile } from "../src/lib/recoveryEligibility.ts";

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
  const { data, error } = await db
    .from("dj_profiles")
    .insert({ dj_name: "New DJ", slug: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })
    .select("id")
    .single();
  if (error) throw error;
  djId = data.id;
});

/*
 * A fresh DJ per email, because dj_lifecycle_emails_once allows exactly
 * one row per (dj_profile_id, template_key). Reusing one DJ made six
 * tests fail with 23505 - the index doing precisely its job, and a
 * reminder that the fixture has to respect the invariant it is testing
 * around.
 */
const seedEmail = async (template: "recovery_1" | "recovery_2", subject: string) => {
  const { data: dj, error: djError } = await db
    .from("dj_profiles")
    .insert({ dj_name: "New DJ", slug: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
    .select("id")
    .single();
  if (djError) throw djError;

  const { data, error } = await db
    .from("dj_lifecycle_emails")
    .insert({
      dj_profile_id: dj.id,
      template_key: template,
      state_at_send: "A",
      status: "sent",
      sent_at: new Date().toISOString(),
      subject_at_send: subject,
    })
    .select("id, subject_at_send, delivery_state")
    .single();
  if (error) throw error;
  return data;
};

const setState = (id: string, state: string | null, at: string | null) =>
  db.from("dj_lifecycle_emails").update({ delivery_state: state, delivery_state_at: at }).eq("id", id);

const readRow = async (id: string) => {
  const { data } = await db
    .from("dj_lifecycle_emails")
    .select("delivery_state, delivery_state_at, subject_at_send")
    .eq("id", id)
    .single();
  return data!;
};

/* ── subject ─────────────────────────────────────────────────── */

test("the subject is stored exactly as sent", async () => {
  const row = await seedEmail("recovery_1", "Two steps from your first paid request");
  assert.equal(row.subject_at_send, "Two steps from your first paid request");
  assert.equal(row.delivery_state, null, "a new row knows nothing about delivery yet");
});

/* ── delivery precedence ─────────────────────────────────────── */

test("delivery advances through the normal sequence", async () => {
  const row = await seedEmail("recovery_2", "Last reminder about your Playing Next setup");
  const t1 = "2026-09-02T21:00:00.000Z";
  const t2 = "2026-09-02T21:05:00.000Z";

  await setState(row.id, "delayed", t1);
  assert.equal((await readRow(row.id)).delivery_state, "delayed");

  await setState(row.id, "delivered", t2);
  const after = await readRow(row.id);
  assert.equal(after.delivery_state, "delivered");
  assert.equal(new Date(after.delivery_state_at!).toISOString(), t2, "keeps the provider event time");
});

test("a duplicate webhook changes nothing", async () => {
  const row = await seedEmail("recovery_1", "dup");
  const t = "2026-09-02T21:10:00.000Z";
  await setState(row.id, "delivered", t);
  await setState(row.id, "delivered", "2026-09-02T23:59:00.000Z");

  const after = await readRow(row.id);
  assert.equal(after.delivery_state, "delivered");
  assert.equal(new Date(after.delivery_state_at!).toISOString(), t, "the first event time stands");
});

test("an out-of-order weaker event cannot walk the state backwards", async () => {
  const row = await seedEmail("recovery_2", "out of order");
  await setState(row.id, "delivered", "2026-09-02T21:00:00.000Z");
  await setState(row.id, "delayed", "2026-09-02T20:59:00.000Z");

  assert.equal((await readRow(row.id)).delivery_state, "delivered");
});

test("complained outranks delivered, because it happens afterwards", async () => {
  const row = await seedEmail("recovery_1", "complaint");
  await setState(row.id, "delivered", "2026-09-02T21:00:00.000Z");
  await setState(row.id, "complained", "2026-09-03T08:00:00.000Z");

  const after = await readRow(row.id);
  assert.equal(after.delivery_state, "complained");
  assert.equal(new Date(after.delivery_state_at!).toISOString(), "2026-09-03T08:00:00.000Z");
});

test("a delivered event after a complaint is ignored", async () => {
  const row = await seedEmail("recovery_2", "late delivered");
  await setState(row.id, "complained", "2026-09-03T08:00:00.000Z");
  await setState(row.id, "delivered", "2026-09-03T09:00:00.000Z");

  assert.equal((await readRow(row.id)).delivery_state, "complained");
});

test("delivery state cannot be cleared back to unknown", async () => {
  const row = await seedEmail("recovery_1", "clearing");
  await setState(row.id, "delivered", "2026-09-02T21:00:00.000Z");
  await setState(row.id, null, null);

  assert.equal((await readRow(row.id)).delivery_state, "delivered");
});

test("an unsupported state is rejected by the check constraint", async () => {
  const row = await seedEmail("recovery_2", "bad state");
  const { error } = await setState(row.id, "opened", "2026-09-02T21:00:00.000Z");
  assert.equal(error?.code, "23514", `expected a check violation, got ${error?.code}`);
});

/* ── profile_completed_at ────────────────────────────────────── */

const asProfile = (patch: Partial<RecoveryProfile>): RecoveryProfile => ({
  id: "x",
  slug: "a-slug",
  dj_name: "New DJ",
  request_price: 500,
  profile_image_url: null,
  stripe_connected: false,
  stripe_account_id: null,
  created_at: new Date().toISOString(),
  ...patch,
});

test("the SQL rule agrees with the TypeScript rule on every combination", async () => {
  const names = [null, "", "New DJ", "Real Name"];
  const prices = [null, 0, 500];
  const photos = [null, "", "https://x.invalid/p.jpg"];
  const slugs = [null, "", "a-slug"];

  for (const dj_name of names)
    for (const request_price of prices)
      for (const profile_image_url of photos)
        for (const slug of slugs) {
          const { data, error } = await db.rpc("is_profile_complete", {
            p_dj_name: dj_name,
            p_request_price: request_price,
            p_profile_image_url: profile_image_url,
            p_slug: slug,
          });

          assert.equal(error, null, error?.message);
          assert.equal(
            data,
            profileComplete(asProfile({ dj_name, request_price, profile_image_url, slug })),
            `SQL and TS disagree for ${JSON.stringify({ dj_name, request_price, profile_image_url, slug })}`
          );
        }
});

test("an incomplete profile is not stamped", async () => {
  await db.from("dj_profiles").update({ dj_name: "Still Nameless" }).eq("id", djId);
  const { data } = await db.from("dj_profiles").select("profile_completed_at").eq("id", djId).single();
  assert.equal(data!.profile_completed_at, null, "no photo yet, so not complete");
});

test("completing the profile stamps it once, and later edits do not move it", async () => {
  await db
    .from("dj_profiles")
    .update({ dj_name: "Real Name", request_price: 500, profile_image_url: "https://x.invalid/p.jpg" })
    .eq("id", djId);

  const { data: first } = await db
    .from("dj_profiles")
    .select("profile_completed_at")
    .eq("id", djId)
    .single();
  assert.ok(first!.profile_completed_at, "should stamp on first completion");

  await db.from("dj_profiles").update({ dj_name: "Renamed Later" }).eq("id", djId);

  const { data: second } = await db
    .from("dj_profiles")
    .select("profile_completed_at")
    .eq("id", djId)
    .single();
  assert.equal(second!.profile_completed_at, first!.profile_completed_at, "write-once");
});

test("clearing a field does not clear the stamp", async () => {
  const { data: before } = await db
    .from("dj_profiles")
    .select("profile_completed_at")
    .eq("id", djId)
    .single();

  await db.from("dj_profiles").update({ profile_image_url: null }).eq("id", djId);

  const { data: after } = await db
    .from("dj_profiles")
    .select("profile_completed_at")
    .eq("id", djId)
    .single();

  assert.equal(after!.profile_completed_at, before!.profile_completed_at,
    "they did complete it once; removing the photo later does not un-happen that");
});

test("a profile created already complete IS stamped, because we were there", async () => {
  const before = Date.now();

  const { data } = await db
    .from("dj_profiles")
    .insert({
      dj_name: "Born Complete",
      slug: `born-${Date.now()}`,
      request_price: 500,
      profile_image_url: "https://x.invalid/p.jpg",
    })
    .select("profile_completed_at")
    .single();

  assert.ok(data!.profile_completed_at, "a complete row created now has a knowable date");
  const at = new Date(data!.profile_completed_at!).getTime();
  assert.ok(at >= before - 5000 && at <= Date.now() + 5000, "and it is now, not something invented");
});

test("a profile created incomplete is not stamped at insert", async () => {
  const { data } = await db
    .from("dj_profiles")
    .insert({ dj_name: "New DJ", slug: `bornish-${Date.now()}` })
    .select("profile_completed_at")
    .single();

  assert.equal(data!.profile_completed_at, null);
});

test("an insert carrying its own date keeps it, so a restore is not re-dated", async () => {
  const original = "2026-08-15T12:00:00.000Z";

  const { data } = await db
    .from("dj_profiles")
    .insert({
      dj_name: "Restored",
      slug: `restored-${Date.now()}`,
      request_price: 500,
      profile_image_url: "https://x.invalid/p.jpg",
      profile_completed_at: original,
    })
    .select("profile_completed_at")
    .single();

  assert.equal(new Date(data!.profile_completed_at!).toISOString(), original);
});

test("a historically complete profile is never stamped by a later edit", async () => {
  /*
   * The case the five existing Production profiles are in: complete, but
   * completed before the column existed, so the date is unknown.
   *
   * Modelled by clearing the stamp an insert would set, which leaves
   * exactly their shape. Editing such a row must NOT date their profile
   * completion to the edit - that would be the same fabrication the
   * migration exists to avoid, just deferred.
   */
  const slug = `legacy-${Date.now()}`;
  const { data: made } = await db
    .from("dj_profiles")
    .insert({
      dj_name: "Legacy Complete",
      slug,
      request_price: 500,
      profile_image_url: "https://x.invalid/p.jpg",
    })
    .select("id")
    .single();

  await db.from("dj_profiles").update({ profile_completed_at: null }).eq("id", made!.id);

  await db.from("dj_profiles").update({ dj_name: "Legacy Renamed" }).eq("id", made!.id);
  await db.from("dj_profiles").update({ profile_image_url: "https://x.invalid/new.jpg" }).eq("id", made!.id);

  const { data: after } = await db
    .from("dj_profiles")
    .select("profile_completed_at")
    .eq("id", made!.id)
    .single();

  assert.equal(after!.profile_completed_at, null,
    "they completed it before we were counting; an edit does not date that");
});
