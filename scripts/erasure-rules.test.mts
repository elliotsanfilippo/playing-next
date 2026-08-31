/*
 * ── The erasure rules, tested without a database ──────────────────
 *
 * Everything in src/lib/erasure.ts and the classification it leans on is
 * pure, so the decisions can be checked here in full: which fields are
 * eligible, which classifications permit what, which references are
 * accepted, and which proofs authorise an erasure.
 *
 * What this CANNOT test is the write itself - the transaction, the
 * rollback, and the audit row - because those need a database, and
 * Production is read-only by rule. Those cases live in the write-path
 * suite and run against a Preview or branch database once one exists.
 */
import { strict as assert } from "node:assert";
import {
  ERASABLE_FIELDS,
  eligibility,
  isValidRequestReference,
  isVerificationMethod,
  VERIFICATION_METHODS,
} from "../src/lib/erasure.ts";
import { classifyRequest, classifyTip } from "../src/lib/retention.ts";

let pass = 0;
const fails: string[] = [];
function check(name: string, fn: () => void) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fails.push(name); console.log("  ✗ " + name + " — " + (e as Error).message); }
}

const noReports = new Set<string>();

console.log("\nCLASSIFICATION");
check("captured request -> preserve", () => {
  assert.equal(classifyRequest({ id:"a", request_status:"played", stripe_payment_intent_id:"pi_1", stripe_checkout_session_id:null, stripe_fee:20, reported_not_played_at:null }, noReports), "preserve");
});
check("played WITHOUT fee -> unknown, never never_charged", () => {
  assert.equal(classifyRequest({ id:"a", request_status:"played", stripe_payment_intent_id:"pi_1", stripe_checkout_session_id:null, stripe_fee:null, reported_not_played_at:null }, noReports), "unknown");
});
check("refunded -> preserve", () => {
  assert.equal(classifyRequest({ id:"a", request_status:"refunded", stripe_payment_intent_id:null, stripe_checkout_session_id:null, stripe_fee:null, reported_not_played_at:null }, noReports), "preserve");
});
check("disputed -> preserve", () => {
  assert.equal(classifyRequest({ id:"a", request_status:"disputed", stripe_payment_intent_id:null, stripe_checkout_session_id:null, stripe_fee:null, reported_not_played_at:null }, noReports), "preserve");
});
check("expired, no PI, no session -> never_charged", () => {
  assert.equal(classifyRequest({ id:"a", request_status:"expired", stripe_payment_intent_id:null, stripe_checkout_session_id:null, stripe_fee:null, reported_not_played_at:null }, noReports), "never_charged");
});
check("expired WITH a session -> unknown (24h late completion)", () => {
  assert.equal(classifyRequest({ id:"a", request_status:"expired", stripe_payment_intent_id:null, stripe_checkout_session_id:"cs_1", stripe_fee:null, reported_not_played_at:null }, noReports), "unknown");
});
check("a not-played report forces unknown", () => {
  assert.equal(classifyRequest({ id:"a", request_status:"expired", stripe_payment_intent_id:null, stripe_checkout_session_id:null, stripe_fee:null, reported_not_played_at:"2026-08-01" }, noReports), "unknown");
});
check("tip succeeded -> preserve even with no fee", () => {
  assert.equal(classifyTip({ id:"t", status:"succeeded", stripe_payment_intent_id:"pi", stripe_checkout_session_id:null, stripe_fee:null }), "preserve");
});

console.log("\nELIGIBILITY — message-bearing records");
for (const cls of ["preserve","never_charged","unknown"] as const) {
  check(`${cls}: message is erasable, row is kept`, () => {
    const e = eligibility({ objectType:"song_request", presentFields:["message"], classification:cls });
    assert.equal(e.eligible, true);
    assert.deepEqual(e.fields, ["message"]);
    assert.ok(e.retained.length > 0);
  });
}
check("no message present -> nothing to erase", () => {
  const e = eligibility({ objectType:"song_request", presentFields:[], classification:"preserve" });
  assert.equal(e.eligible, false);
  assert.deepEqual(e.fields, []);
});
check("tip message erasable", () => {
  assert.equal(eligibility({ objectType:"tip", presentFields:["message"], classification:"preserve" }).eligible, true);
});
check("report reason erasable, report itself retained", () => {
  const e = eligibility({ objectType:"not_played_report", presentFields:["reason"], classification:"preserve" });
  assert.equal(e.eligible, true);
  assert.deepEqual(e.fields, ["reason"]);
  assert.match(e.retained, /report itself/i);
});

console.log("\nELIGIBILITY — QR box orders");
check("abandoned + never_charged -> address erasable", () => {
  const e = eligibility({ objectType:"qr_box_order", presentFields:["recipient_name","address_line1","city","postcode","country"], classification:"never_charged", orderStatus:"pending_payment" });
  assert.equal(e.eligible, true);
  assert.equal(e.fields.length, 5);
});
check("PAID order -> refused, with a reason", () => {
  const e = eligibility({ objectType:"qr_box_order", presentFields:["recipient_name","address_line1"], classification:"preserve", orderStatus:"paid" });
  assert.equal(e.eligible, false);
  assert.deepEqual(e.fields, []);
  assert.match(e.reason, /fulfilment|delivery|returns|courier/i);
});
check("abandoned but classification unknown -> refused", () => {
  const e = eligibility({ objectType:"qr_box_order", presentFields:["recipient_name"], classification:"unknown", orderStatus:"pending_payment" });
  assert.equal(e.eligible, false);
});
check("only the fields actually present are listed", () => {
  const e = eligibility({ objectType:"qr_box_order", presentFields:["city"], classification:"never_charged", orderStatus:"pending_payment" });
  assert.deepEqual(e.fields, ["city"]);
});

console.log("\nPRIVACY-REQUEST REFERENCE");
for (const good of ["PR-2026-001","PR-2026-00042","PR-1999-123"]) {
  check(`accepts ${good}`, () => assert.equal(isValidRequestReference(good), true));
}
for (const bad of ["someone@example.com","John Smith","07700 900123","PR-26-1","pr-2026-001"," PR-2026-001","PR-2026-001 ","", "guest asked us to delete his message","PR-2026-1"]) {
  check(`rejects ${JSON.stringify(bad)}`, () => assert.equal(isValidRequestReference(bad), false));
}

console.log("\nOWNERSHIP VERIFICATION");
for (const m of VERIFICATION_METHODS) {
  check(`accepts proof: ${m}`, () => assert.equal(isVerificationMethod(m), true));
}
for (const bad of ["attribute_match","dj_date_song","admin_says_so",null,undefined,"","stripe"]) {
  check(`rejects proof: ${JSON.stringify(bad)}`, () => assert.equal(isVerificationMethod(bad), false));
}

console.log("\nFIELD MAP");
check("song_request clears only message", () => assert.deepEqual(ERASABLE_FIELDS.song_request, ["message"]));
check("tip clears only message", () => assert.deepEqual(ERASABLE_FIELDS.tip, ["message"]));
check("not_played_report clears only reason", () => assert.deepEqual(ERASABLE_FIELDS.not_played_report, ["reason"]));
check("qr_box_order clears exactly the six address fields", () => {
  assert.deepEqual(ERASABLE_FIELDS.qr_box_order, ["recipient_name","address_line1","address_line2","city","postcode","country"]);
});
check("no financial or operational field is ever erasable", () => {
  const forbidden = ["stripe_fee","total_amount","dj_earnings","platform_fee","stripe_payment_intent_id","request_status","created_at","dj_profile_id","id","song_title","artist","shipping_amount","status","resolution"];
  for (const list of Object.values(ERASABLE_FIELDS))
    for (const f of list)
      assert.ok(!forbidden.includes(f), `${f} must not be erasable`);
});

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log("FAILED:\n  " + fails.join("\n  ")); process.exit(1); }
