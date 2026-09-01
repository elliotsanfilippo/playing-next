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
/*
 * Normalised, because the Supabase dashboard shows several URL forms and
 * the REST endpoint is the one sitting next to the API keys you came for.
 * Pasting "https://<ref>.supabase.co/rest/v1/" makes every request
 * "/rest/v1//rest/v1/..." and returns PGRST125 "Invalid path", which
 * reads like a missing table rather than a malformed base URL.
 *
 * Stripping a trailing slash and a trailing /rest/v1 cannot weaken the
 * Production guard below: that tests for the project ref inside the
 * host, which normalisation does not touch.
 */
const URL_ = (process.env.TEST_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/, "");
const KEY = (process.env.TEST_SERVICE_ROLE_KEY ?? "").trim();

if (!URL_ || !KEY) {
  console.error("Set TEST_SUPABASE_URL and TEST_SERVICE_ROLE_KEY to a Preview or branch database.");
  process.exit(2);
}
if (URL_.includes(PRODUCTION_REF)) {
  console.error("REFUSING TO RUN: that is the Production project. This suite writes and deletes rows.");
  process.exit(2);
}

/*
 * Printed every run, not buried in a file, because a green result from
 * this suite is easy to over-read. It proves the transaction. It proves
 * nothing about Production.
 */
console.log(`
═══════════════════════════════════════════════════════════════
 ERASURE WRITE-PATH SUITE · isolated test project
 ${URL_}

 PROVES     the erase_personal_fields transaction, its rollback,
            and the contents of the audit record. Those two objects
            are the real canonical definitions from
            supabase/migrations/, not copies.

 PROVES NOT anything about Production. The fixture source tables are
            inferred from the PostgREST description, which does not
            expose CHECK constraints, RLS, grants, triggers or
            indexes. Production security was verified separately,
            against Production, read-only, on 2026-08-31.

 DATA       synthetic fixtures only, removed at the end. Production
            data must never be loaded here.
═══════════════════════════════════════════════════════════════
`);

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
type Row = Record<string, unknown>;
/* Row values are unknown by design; ids are read through this so a typo
   in a column name is a compile error rather than a runtime undefined. */
const id = (r: Row) => r.id as string;
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
  /*
   * The suite creates its own DJ rather than requiring one. A test that
   * needs the database seeded by hand first is a test that will be run
   * against whatever happens to be lying around, which for this project
   * should be nothing at all.
   */
  const existing = (await api("dj_profiles?select=id&limit=1")).body[0];
  const createdDj = existing
    ? null
    : (await api("dj_profiles", { method: "POST", body: JSON.stringify({
        dj_name: "Erasure Suite Fixture", slug: "erasure-suite-fixture",
      })})).body[0];
  const DJ = (existing ?? createdDj)?.id as string | undefined;
  assert.ok(DJ, "could not create a fixture dj_profile");

  console.log("\nSONG REQUEST · message");
  const sr = (await api("song_requests", { method: "POST", body: JSON.stringify({
    dj_profile_id: DJ, song_title: "Test", artist: "Test", message: "erase me",
    request_status: "played", stripe_fee: 20, stripe_payment_intent_id: "pi_test_preserve",
  })})).body[0] as Row;

  await check("preserve: clears message, changes nothing else, one audit row", async () => {
    const before = await snapshot("song_requests", id(sr));
    const r = await rpc("erase_personal_fields", { p_object_type: "song_request", p_object_id: id(sr), p_classification: "preserve", p_performed_by: "test@example.com", p_request_reference: "PR-2026-001" });
    assert.ok(r.ok, `rpc failed: ${JSON.stringify(r.raw)}`);
    const after = await snapshot("song_requests", id(sr));
    assert.deepEqual(diff(before, after), ["message"], "only message may change");
    assert.equal(after.message, null);
    assert.equal(after.stripe_fee, before.stripe_fee, "financial field changed");
    assert.equal(after.total_amount, before.total_amount, "financial field changed");
    assert.equal(after.request_status, before.request_status, "operational field changed");
    const a = await audits(id(sr));
    assert.equal(a.length, 1, "exactly one audit row");
    assert.deepEqual(a[0].fields_cleared, ["message"]);
    assert.equal(a[0].row_deleted, false);
    assert.equal(a[0].classification, "preserve");
    assert.ok(!JSON.stringify(a[0]).includes("erase me"), "erased value leaked into the audit row");
  });

  await check("row still exists — erasure never deletes", async () => {
    const r = await api(`song_requests?id=eq.${id(sr)}&select=id`);
    assert.equal(r.body.length, 1);
  });

  await check("repeat request: no change, no second audit row", async () => {
    const r = await rpc("erase_personal_fields", { p_object_type: "song_request", p_object_id: id(sr), p_classification: "preserve", p_performed_by: "test@example.com", p_request_reference: "PR-2026-002" });
    assert.equal(r.ok, false, "second call should refuse");
    const a = await audits(id(sr));
    assert.equal(a.length, 1, "a repeat must not add an audit row");
  });

  console.log("\nCLASSIFICATIONS · unknown and never_charged recorded truthfully");
  /* played with no stripe_fee: the case that must never read as unpaid. */
  const unk = (await api("song_requests", { method: "POST", body: JSON.stringify({
    dj_profile_id: DJ, song_title: "Unknown", artist: "T", message: "unknown class",
    request_status: "played", stripe_payment_intent_id: "pi_test_unknown",
  })})).body[0] as Row;
  await check("unknown: message cleared, classification recorded as unknown", async () => {
    const before = await snapshot("song_requests", id(unk));
    const r = await rpc("erase_personal_fields", { p_object_type: "song_request", p_object_id: id(unk), p_classification: "unknown", p_performed_by: "test@example.com", p_request_reference: "PR-2026-010" });
    assert.ok(r.ok, JSON.stringify(r.raw));
    const after = await snapshot("song_requests", id(unk));
    assert.deepEqual(diff(before, after), ["message"]);
    assert.equal(after.stripe_payment_intent_id, before.stripe_payment_intent_id);
    const a = await audits(id(unk));
    assert.equal(a.length, 1);
    assert.equal(a[0].classification, "unknown");
  });

  const nc = (await api("song_requests", { method: "POST", body: JSON.stringify({
    dj_profile_id: DJ, song_title: "NeverCharged", artist: "T", message: "never charged class",
    request_status: "expired",
  })})).body[0] as Row;
  await check("never_charged: message cleared, classification recorded, row kept", async () => {
    const r = await rpc("erase_personal_fields", { p_object_type: "song_request", p_object_id: id(nc), p_classification: "never_charged", p_performed_by: "test@example.com", p_request_reference: "PR-2026-011" });
    assert.ok(r.ok, JSON.stringify(r.raw));
    const a = await audits(id(nc));
    assert.equal(a.length, 1);
    assert.equal(a[0].classification, "never_charged");
    assert.equal(a[0].row_deleted, false);
    assert.equal((await api(`song_requests?id=eq.${id(nc)}&select=id`)).body.length, 1, "row must survive");
  });

  console.log("\nROLLBACK · a failing audit insert must undo the clear");
  const rb = (await api("song_requests", { method: "POST", body: JSON.stringify({
    dj_profile_id: DJ, song_title: "Rollback", artist: "T", message: "must survive",
    request_status: "expired",
  })})).body[0] as Row;
  await check("invalid reference violates the CHECK, so the message survives", async () => {
    const r = await rpc("erase_personal_fields", { p_object_type: "song_request", p_object_id: id(rb), p_classification: "never_charged", p_performed_by: "test@example.com", p_request_reference: "NOT A REFERENCE" });
    assert.equal(r.ok, false, "should fail on the reference CHECK");
    const after = await snapshot("song_requests", id(rb));
    assert.equal(after.message, "must survive", "the clear was not rolled back");
    assert.equal((await audits(id(rb))).length, 0, "no audit row may survive a rollback");
  });

  console.log("\nTIP · message");
  const tip = (await api("tips", { method: "POST", body: JSON.stringify({ dj_profile_id: DJ, message: "tip note", status: "succeeded", amount: 500 })})).body[0] as Row;
  await check("tip message cleared, money untouched, one audit row", async () => {
    const before = await snapshot("tips", id(tip));
    const r = await rpc("erase_personal_fields", { p_object_type: "tip", p_object_id: id(tip), p_classification: "preserve", p_performed_by: "test@example.com", p_request_reference: null });
    assert.ok(r.ok);
    const after = await snapshot("tips", id(tip));
    assert.deepEqual(diff(before, after), ["message"]);
    assert.equal(after.amount, before.amount);
    assert.equal((await audits(id(tip))).length, 1);
  });

  console.log("\nNOT-PLAYED REPORT · reason");
  const rep = (await api("not_played_reports", { method: "POST", body: JSON.stringify({ song_request_id: id(sr), dj_profile_id: DJ, reason: "never played it", resolution: "denied" })})).body[0] as Row;
  await check("reason cleared, report and outcome preserved", async () => {
    const before = await snapshot("not_played_reports", id(rep));
    const r = await rpc("erase_personal_fields", { p_object_type: "not_played_report", p_object_id: id(rep), p_classification: "preserve", p_performed_by: "test@example.com", p_request_reference: null });
    assert.ok(r.ok);
    const after = await snapshot("not_played_reports", id(rep));
    assert.deepEqual(diff(before, after), ["reason"]);
    assert.equal(after.resolution, "denied");
    assert.equal((await api(`not_played_reports?id=eq.${id(rep)}&select=id`)).body.length, 1);
  });

  console.log("\nQR BOX ORDER");
  const abandoned = (await api("qr_box_orders", { method: "POST", body: JSON.stringify({ dj_profile_id: DJ, recipient_name: "A Person", address_line1: "1 Test St", city: "Glasgow", postcode: "G1 1AA", country: "GB", status: "pending_payment", shipping_amount: 399 })})).body[0] as Row;
  await check("abandoned order: all present address fields cleared", async () => {
    const before = await snapshot("qr_box_orders", id(abandoned));
    const r = await rpc("erase_personal_fields", { p_object_type: "qr_box_order", p_object_id: id(abandoned), p_classification: "never_charged", p_performed_by: "test@example.com", p_request_reference: "PR-2026-003" });
    assert.ok(r.ok, JSON.stringify(r.raw));
    const after = await snapshot("qr_box_orders", id(abandoned));
    assert.deepEqual(diff(before, after).sort(), ["address_line1","city","country","postcode","recipient_name"]);
    assert.equal(after.shipping_amount, before.shipping_amount, "financial field changed");
    assert.equal(after.status, before.status, "operational field changed");
    const a = await audits(id(abandoned));
    assert.equal(a.length, 1);
    assert.equal((a[0].fields_cleared as string[]).length, 5, "address_line2 was null and must not be listed");
    assert.ok(!JSON.stringify(a[0]).match(/Test St|Glasgow|G1 1AA|A Person/), "address leaked into the audit row");
  });

  const paid = (await api("qr_box_orders", { method: "POST", body: JSON.stringify({ dj_profile_id: DJ, recipient_name: "Paid Person", address_line1: "2 Test St", city: "Glasgow", postcode: "G2 2BB", country: "GB", status: "paid", stripe_payment_intent_id: "pi_test_paid", shipping_amount: 399 })})).body[0] as Row;
  await check("PAID order: refused by the database, address intact, no audit row", async () => {
    const before = await snapshot("qr_box_orders", id(paid));
    const r = await rpc("erase_personal_fields", { p_object_type: "qr_box_order", p_object_id: id(paid), p_classification: "preserve", p_performed_by: "test@example.com", p_request_reference: "PR-2026-004" });
    assert.equal(r.ok, false, "a paid order must be refused even if the API is bypassed");
    const after = await snapshot("qr_box_orders", id(paid));
    assert.deepEqual(diff(before, after), []);
    assert.equal((await audits(id(paid))).length, 0);
  });

  console.log("\nGUARDS");
  await check("missing performed_by is refused", async () => {
    const r = await rpc("erase_personal_fields", { p_object_type: "song_request", p_object_id: id(rb), p_classification: "unknown", p_performed_by: "", p_request_reference: null });
    assert.equal(r.ok, false);
  });
  await check("unknown object_type is refused", async () => {
    const r = await rpc("erase_personal_fields", { p_object_type: "dj_profile", p_object_id: id(rb), p_classification: "unknown", p_performed_by: "t@e.com", p_request_reference: null });
    assert.equal(r.ok, false);
  });
  await check("no audit row anywhere claims row_deleted", async () => {
    const all = await api("data_erasures?select=row_deleted");
    assert.ok(all.body.every((a) => a.row_deleted === false));
  });
  await check("no erased value appears anywhere in the audit log", async () => {
    const all = JSON.stringify((await api("data_erasures?select=*")).body);
    for (const secret of ["erase me", "must survive", "tip note", "never played it",
                          "A Person", "1 Test St", "Glasgow", "G1 1AA",
                          "unknown class", "never charged class"]) {
      assert.ok(!all.includes(secret), `audit log leaked a value`);
    }
  });
  await check("every audit row names only real field names", async () => {
    const allowed = new Set(["message","reason","recipient_name","address_line1","address_line2","city","postcode","country"]);
    for (const a of (await api("data_erasures?select=fields_cleared")).body)
      for (const f of a.fields_cleared as string[])
        assert.ok(allowed.has(f), `unexpected field name in audit: ${f}`);
  });

  /*
   * Remove every fixture this run created. data_erasures is append-only
   * by design, so its rows cannot be deleted here - which is correct,
   * and is why this project is disposable rather than long-lived.
   */
  console.log("\nCLEANUP");
  for (const [table, rowId] of [
    ["not_played_reports", id(rep)],
    ["song_requests", id(sr)],
    ["song_requests", id(rb)],
    ["song_requests", id(unk)],
    ["song_requests", id(nc)],
    ["tips", id(tip)],
    ["qr_box_orders", id(abandoned)],
    ["qr_box_orders", id(paid)],
  ] as [string, string][]) {
    await api(`${table}?id=eq.${rowId}`, { method: "DELETE" });
  }
  /* Only if this run created it; never remove something already there. */
  if (createdDj) await api(`dj_profiles?id=eq.${id(createdDj)}`, { method: "DELETE" });
  const leftovers = await Promise.all(
    ["song_requests", "tips", "not_played_reports", "qr_box_orders"].map(
      async (t) => `${t}=${(await api(`${t}?select=id`)).body.length}`
    )
  );
  console.log("  remaining fixture rows: " + leftovers.join(" "));
  const audit = await api("data_erasures?select=id");
  console.log(`  data_erasures rows: ${audit.body.length} (append-only, retained deliberately)`);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log("FAILED:\n  " + fails.join("\n  ")); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
