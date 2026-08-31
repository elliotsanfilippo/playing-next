/*
 * ── The erasure write path. NOT for Production ────────────────────
 *
 * Everything here inserts, updates and rolls back rows, so it must never
 * touch Production. The guard below refuses to run against the live
 * project ref, and there is no flag to override it.
 *
 * Run against a Preview or branch database:
 *   TEST_SUPABASE_URL=https://<branch>.supabase.co \
 *   TEST_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/erasure-writepath.test.mts
 *
 * Requires both schema migrations plus 20260831_erase_atomically.sql.
 */
import { strict as assert } from "node:assert";

const PRODUCTION_REF = "bxryfvyzbxnmwicqdmag";
const URL_ = process.env.TEST_SUPABASE_URL ?? "";
const KEY = process.env.TEST_SERVICE_ROLE_KEY ?? "";

if (!URL_ || !KEY) {
  console.error("Set TEST_SUPABASE_URL and TEST_SERVICE_ROLE_KEY to a Preview or branch database.");
  process.exit(2);
}
if (URL_.includes(PRODUCTION_REF)) {
  console.error("REFUSING TO RUN: that is the Production project. This suite writes and deletes rows.");
  process.exit(2);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
type Row = Record<string, unknown>;
const api = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const t = await r.text(); let j: unknown = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, ok: r.ok, body: (Array.isArray(j) ? j : []) as Row[], raw: j };
};
const rpc = (fn: string, args: Record<string, unknown>) =>
  api(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

let pass = 0; const fails: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try { await fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fails.push(name); console.log("  ✗ " + name + " — " + (e as Error).message); }
};

/* Snapshot every column so "nothing else changed" is provable, not asserted. */
const snapshot = async (table: string, id: string) =>
  (await api(`${table}?id=eq.${id}&select=*`)).body[0] as Row;

const diff = (before: Record<string, unknown>, after: Record<string, unknown>) =>
  Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));

const audits = async (objectId: string) =>
  (await api(`data_erasures?object_id=eq.${objectId}&select=*`)).body;

async function main() {
  const DJ = (await api("dj_profiles?select=id&limit=1")).body[0]?.id as string | undefined;
  assert.ok(DJ, "the Preview database needs at least one dj_profile");

  console.log("\nSONG REQUEST · message");
  const sr = (await api("song_requests", { method: "POST", body: JSON.stringify({
    dj_profile_id: DJ, song_title: "Test", artist: "Test", message: "erase me",
    request_status: "played", stripe_fee: 20, stripe_payment_intent_id: "pi_test_preserve",
  })})).body[0] as Row;

  await check("preserve: clears message, changes nothing else, one audit row", async () => {
    const before = await snapshot("song_requests", sr.id);
    const r = await rpc("erase_personal_fields", { p_object_type: "song_request", p_object_id: sr.id, p_classification: "preserve", p_performed_by: "test@example.com", p_request_reference: "PR-2026-001" });
    assert.ok(r.ok, `rpc failed: ${JSON.stringify(r.raw)}`);
    const after = await snapshot("song_requests", sr.id);
    assert.deepEqual(diff(before, after), ["message"], "only message may change");
    assert.equal(after.message, null);
    assert.equal(after.stripe_fee, before.stripe_fee, "financial field changed");
    assert.equal(after.total_amount, before.total_amount, "financial field changed");
    assert.equal(after.request_status, before.request_status, "operational field changed");
    const a = await audits(sr.id);
    assert.equal(a.length, 1, "exactly one audit row");
    assert.deepEqual(a[0].fields_cleared, ["message"]);
    assert.equal(a[0].row_deleted, false);
    assert.equal(a[0].classification, "preserve");
    assert.ok(!JSON.stringify(a[0]).includes("erase me"), "erased value leaked into the audit row");
  });

  await check("row still exists — erasure never deletes", async () => {
    const r = await api(`song_requests?id=eq.${sr.id}&select=id`);
    assert.equal(r.body.length, 1);
  });

  await check("repeat request: no change, no second audit row", async () => {
    const r = await rpc("erase_personal_fields", { p_object_type: "song_request", p_object_id: sr.id, p_classification: "preserve", p_performed_by: "test@example.com", p_request_reference: "PR-2026-002" });
    assert.equal(r.ok, false, "second call should refuse");
    const a = await audits(sr.id);
    assert.equal(a.length, 1, "a repeat must not add an audit row");
  });

  console.log("\nROLLBACK · a failing audit insert must undo the clear");
  const rb = (await api("song_requests", { method: "POST", body: JSON.stringify({
    dj_profile_id: DJ, song_title: "Rollback", artist: "T", message: "must survive",
    request_status: "expired",
  })})).body[0] as Row;
  await check("invalid reference violates the CHECK, so the message survives", async () => {
    const r = await rpc("erase_personal_fields", { p_object_type: "song_request", p_object_id: rb.id, p_classification: "never_charged", p_performed_by: "test@example.com", p_request_reference: "NOT A REFERENCE" });
    assert.equal(r.ok, false, "should fail on the reference CHECK");
    const after = await snapshot("song_requests", rb.id);
    assert.equal(after.message, "must survive", "the clear was not rolled back");
    assert.equal((await audits(rb.id)).length, 0, "no audit row may survive a rollback");
  });

  console.log("\nTIP · message");
  const tip = (await api("tips", { method: "POST", body: JSON.stringify({ dj_profile_id: DJ, message: "tip note", status: "succeeded", amount: 500 })})).body[0] as Row;
  await check("tip message cleared, money untouched, one audit row", async () => {
    const before = await snapshot("tips", tip.id);
    const r = await rpc("erase_personal_fields", { p_object_type: "tip", p_object_id: tip.id, p_classification: "preserve", p_performed_by: "test@example.com", p_request_reference: null });
    assert.ok(r.ok);
    const after = await snapshot("tips", tip.id);
    assert.deepEqual(diff(before, after), ["message"]);
    assert.equal(after.amount, before.amount);
    assert.equal((await audits(tip.id)).length, 1);
  });

  console.log("\nNOT-PLAYED REPORT · reason");
  const rep = (await api("not_played_reports", { method: "POST", body: JSON.stringify({ song_request_id: sr.id, dj_profile_id: DJ, reason: "never played it", resolution: "denied" })})).body[0] as Row;
  await check("reason cleared, report and outcome preserved", async () => {
    const before = await snapshot("not_played_reports", rep.id);
    const r = await rpc("erase_personal_fields", { p_object_type: "not_played_report", p_object_id: rep.id, p_classification: "preserve", p_performed_by: "test@example.com", p_request_reference: null });
    assert.ok(r.ok);
    const after = await snapshot("not_played_reports", rep.id);
    assert.deepEqual(diff(before, after), ["reason"]);
    assert.equal(after.resolution, "denied");
    assert.equal((await api(`not_played_reports?id=eq.${rep.id}&select=id`)).body.length, 1);
  });

  console.log("\nQR BOX ORDER");
  const abandoned = (await api("qr_box_orders", { method: "POST", body: JSON.stringify({ dj_profile_id: DJ, recipient_name: "A Person", address_line1: "1 Test St", city: "Glasgow", postcode: "G1 1AA", country: "GB", status: "pending_payment", shipping_amount: 399 })})).body[0] as Row;
  await check("abandoned order: all present address fields cleared", async () => {
    const before = await snapshot("qr_box_orders", abandoned.id);
    const r = await rpc("erase_personal_fields", { p_object_type: "qr_box_order", p_object_id: abandoned.id, p_classification: "never_charged", p_performed_by: "test@example.com", p_request_reference: "PR-2026-003" });
    assert.ok(r.ok, JSON.stringify(r.raw));
    const after = await snapshot("qr_box_orders", abandoned.id);
    assert.deepEqual(diff(before, after).sort(), ["address_line1","city","country","postcode","recipient_name"]);
    assert.equal(after.shipping_amount, before.shipping_amount, "financial field changed");
    assert.equal(after.status, before.status, "operational field changed");
    const a = await audits(abandoned.id);
    assert.equal(a.length, 1);
    assert.equal((a[0].fields_cleared as string[]).length, 5, "address_line2 was null and must not be listed");
    assert.ok(!JSON.stringify(a[0]).match(/Test St|Glasgow|G1 1AA|A Person/), "address leaked into the audit row");
  });

  const paid = (await api("qr_box_orders", { method: "POST", body: JSON.stringify({ dj_profile_id: DJ, recipient_name: "Paid Person", address_line1: "2 Test St", city: "Glasgow", postcode: "G2 2BB", country: "GB", status: "paid", stripe_payment_intent_id: "pi_test_paid", shipping_amount: 399 })})).body[0] as Row;
  await check("PAID order: refused by the database, address intact, no audit row", async () => {
    const before = await snapshot("qr_box_orders", paid.id);
    const r = await rpc("erase_personal_fields", { p_object_type: "qr_box_order", p_object_id: paid.id, p_classification: "preserve", p_performed_by: "test@example.com", p_request_reference: "PR-2026-004" });
    assert.equal(r.ok, false, "a paid order must be refused even if the API is bypassed");
    const after = await snapshot("qr_box_orders", paid.id);
    assert.deepEqual(diff(before, after), []);
    assert.equal((await audits(paid.id)).length, 0);
  });

  console.log("\nGUARDS");
  await check("missing performed_by is refused", async () => {
    const r = await rpc("erase_personal_fields", { p_object_type: "song_request", p_object_id: rb.id, p_classification: "unknown", p_performed_by: "", p_request_reference: null });
    assert.equal(r.ok, false);
  });
  await check("unknown object_type is refused", async () => {
    const r = await rpc("erase_personal_fields", { p_object_type: "dj_profile", p_object_id: rb.id, p_classification: "unknown", p_performed_by: "t@e.com", p_request_reference: null });
    assert.equal(r.ok, false);
  });
  await check("no audit row anywhere claims row_deleted", async () => {
    const all = await api("data_erasures?select=row_deleted");
    assert.ok(all.body.every((a) => a.row_deleted === false));
  });

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log("FAILED:\n  " + fails.join("\n  ")); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
