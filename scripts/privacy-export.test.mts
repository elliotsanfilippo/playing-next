/*
 * The data-subject export and its audit.
 *
 * The renderer tests are pure. The audit tests write, and therefore run
 * ONLY against the isolated Playing Next Test project, refusing to start
 * if the URL resolves to Production. Nothing here processes a real
 * privacy request or reads a real guest's records.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  buildExportJson,
  renderExportPdf,
  dataPeriod,
  WORDING,
  SCHEMA_VERSION,
  GENERATOR_VERSION,
  type ExportSnapshot,
} from "../src/lib/privacyExport.ts";

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

/*
 * Reading the text back out of a PDF.
 *
 * Searching the raw buffer for a substring does not work: PDFKit writes
 * text as positioned runs, so "Playing Next" can arrive as several
 * separate (…)Tj operators and a plain includes() misses it. That is not
 * a harmless flaw in a test - the ABSENCE assertions below would have
 * passed vacuously, and a test that cannot fail is worse than no test.
 *
 * So the content streams are parsed properly: every parenthesised string
 * literal, unescaped and concatenated. Requires compress:false, which is
 * why the renderer takes that option.
 */
const pdfText = (buffer: Buffer): string => {
  const raw = buffer.toString("latin1");
  const out: string[] = [];

  /*
   * PDFKit writes text as HEX strings inside TJ arrays, like
   *   [<43414e4152> 50 <59> 140 <2d58595a>] TJ
   * not as parenthesised literals. An earlier version of this helper
   * looked for "(...)" and found nothing, which quietly turned every
   * absence assertion below into a test that could not fail.
   *
   * Kerning splits a single word across several runs, so the chunks are
   * concatenated with nothing between them and the numbers between them
   * are ignored.
   */
  for (const chunk of raw.matchAll(/<([0-9a-fA-F]+)>/g)) {
    const hex = chunk[1];
    if (hex.length % 2 !== 0) continue;
    let text = "";
    for (let i = 0; i < hex.length; i += 2) {
      text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    out.push(text);
  }

  /* Parenthesised literals too, for anything PDFKit writes that way. */
  for (const match of raw.matchAll(/\(((?:[^()\\]|\\.)*)\)/g)) {
    out.push(match[1].replace(/\\([()\\])/g, "$1"));
  }

  return out.join("");
};

/* Distinctive strings, so a leak is unmistakable in any buffer. */
const MESSAGE = "SYNTHETIC-MESSAGE-canary-7f3a play something loud";
const REASON = "SYNTHETIC-REASON-canary-9b2c it never got played";

const snapshot = (records: ExportSnapshot["records"] = []): ExportSnapshot => ({
  requestReference: "PR-2026-900",
  verificationMethod: "quoted_message",
  generatedAt: "2026-09-03T21:00:00.000Z",
  appCommit: "deadbee",
  records,
});

const oneOfEach = (): ExportSnapshot["records"] => [
  {
    type: "song_request",
    id: "11111111-1111-1111-1111-111111111111",
    created_at: "2026-08-28T13:40:57.510Z",
    dj_name: "ELSAN",
    dj_slug: "elsan",
    song_title: "A Song",
    artist: "An Artist",
    message: MESSAGE,
    status: "played",
    refunded: false,
    currency: "gbp",
    total_paid: 550,
    guest_service_fee: 50,
  },
  {
    type: "tip",
    id: "22222222-2222-2222-2222-222222222222",
    created_at: "2026-08-29T10:00:00.000Z",
    dj_name: "ELSAN",
    dj_slug: "elsan",
    message: null,
    status: "refunded",
    refunded: true,
    currency: "gbp",
    total_paid: 300,
    guest_service_fee: 30,
  },
  {
    type: "not_played_report",
    id: "33333333-3333-3333-3333-333333333333",
    created_at: "2026-08-30T09:00:00.000Z",
    reason: REASON,
    song_request_id: "11111111-1111-1111-1111-111111111111",
    resolution: "refunded",
  },
];

/* ── one snapshot, two artefacts ──────────────────────────────── */

test("the PDF and the JSON are rendered from the same snapshot", async () => {
  const snap = snapshot(oneOfEach());
  const json = buildExportJson(snap);
  const pdf = pdfText(await renderExportPdf(snap, { compress: false }));

  /* Same instant, same reference, same schema in both. */
  assert.equal(json.generated_at, snap.generatedAt);
  assert.ok(pdf.includes("PR-2026-900"), "the PDF carries the same reference");
  assert.ok(pdf.includes(SCHEMA_VERSION), "the PDF carries the same schema version");

  /* Same content: the message appears in both, from one source. */
  assert.equal(json.song_requests[0]!.your_message, MESSAGE);
  assert.ok(pdf.includes("SYNTHETIC-MESSAGE-canary-7f3a"), "the message reached the PDF");
  assert.ok(pdf.includes("SYNTHETIC-REASON-canary-9b2c"), "the reason reached the PDF");

  /* Same counts. */
  assert.deepEqual(json.totals, { song_requests: 1, tips: 1, not_played_reports: 1 });
});

test("the scope statement is verbatim, and in the PDF", async () => {
  const snap = snapshot(oneOfEach());
  const json = buildExportJson(snap);
  const pdf = pdfText(await renderExportPdf(snap, { compress: false }));

  assert.equal(
    WORDING.scope,
    "This export covers only Playing Next records for which ownership was " +
      "verified as part of this request. It is not a complete export of " +
      "information held by other services, including Stripe."
  );
  assert.equal(json.about_this_export.scope, WORDING.scope);
  assert.ok(pdf.includes("This export covers only Playing Next records"));
});

test("the wording never characterises Stripe's legal role", async () => {
  const snap = snapshot(oneOfEach());
  const pdf = pdfText(await renderExportPdf(snap, { compress: false }));
  const blob = `${JSON.stringify(buildExportJson(snap))} ${pdf}`.toLowerCase();

  for (const word of ["controller", "processor", "data controller", "joint control"]) {
    assert.ok(!blob.includes(word), `the export must not say "${word}"`);
  }
  assert.ok(WORDING.stripe.startsWith("Playing Next does not receive or store"));
});

test("no invented financial retention period is stated", async () => {
  const snap = snapshot(oneOfEach());
  const pdf = pdfText(await renderExportPdf(snap, { compress: false }));

  assert.ok(WORDING.retention.includes("90 days"), "the decided rule may be stated");
  assert.ok(
    WORDING.retention.includes("as long as legal and accounting obligations require"),
    "the undecided one must not be given a number"
  );
  for (const invented of ["six years", "6 years", "seven years", "five years"]) {
    assert.ok(!pdf.toLowerCase().includes(invented), `must not claim ${invented}`);
  }
});

test("internal pricing and margin never reach either artefact", async () => {
  const snap = snapshot(oneOfEach());
  const json = JSON.stringify(buildExportJson(snap));
  const pdf = pdfText(await renderExportPdf(snap, { compress: false }));

  for (const field of [
    "dj_earnings",
    "platform_fee",
    "platform_fee_rate_bps",
    "stripe_fee",
    "stripe_processing_fee",
    "plan_at_checkout",
    "pricing_version",
    "request_amount",
  ]) {
    assert.ok(!json.includes(field), `${field} must not be in the JSON`);
    assert.ok(!pdf.includes(field), `${field} must not be in the PDF`);
  }
});

test("a nil result is a valid, complete export", async () => {
  const snap = snapshot([]);
  const json = buildExportJson(snap);
  const pdf = await renderExportPdf(snap, { compress: false });

  assert.deepEqual(json.totals, { song_requests: 0, tips: 0, not_played_reports: 0 });
  assert.equal(json.data_period.earliest_record, null);
  assert.equal(json.data_period.latest_record, null);
  assert.equal(json.data_period.generated_as_at, snap.generatedAt);

  assert.ok(pdf.length > 1000, "a document is still produced");
  assert.ok(pdfText(pdf).includes("We hold no song requests for you."));
});

test("data_period describes the records, not the request", () => {
  const period = dataPeriod(oneOfEach());
  assert.equal(period.earliest_record, "2026-08-28T13:40:57.510Z");
  assert.equal(period.latest_record, "2026-08-30T09:00:00.000Z");
});

test("version metadata is carried for reproducibility", () => {
  const json = buildExportJson(snapshot(oneOfEach()));
  assert.equal(json.versions.schema, SCHEMA_VERSION);
  assert.equal(json.versions.generator_version, GENERATOR_VERSION);
  assert.equal(json.versions.app_commit, "deadbee");
});

test("refund status is derived from our own status, never from Stripe", () => {
  const json = buildExportJson(snapshot(oneOfEach()));
  assert.equal(json.tips[0]!.refunded, true, "a refunded status reads as refunded");
  assert.equal(json.song_requests[0]!.refunded, false);
});

/* ── the CRM must never render a guest's words ────────────────── */

test("the lookup response carries field names, never contents", () => {
  const source = readFileSync("app/api/admin/privacy/lookup/route.ts", "utf8");

  /*
   * The route reads message and reason from the database - it has to, to
   * know whether they are present - so what matters is that their VALUES
   * are never copied into the response. An earlier version checked the
   * Candidate type for "reason:" and failed on `reason: string`, which is
   * the eligibility explanation and has nothing to do with a guest.
   */
  for (const copy of [
    "message: r.message",
    "reason: r.reason",
    "message: row.message",
    "recipient_name: r.recipient_name",
  ]) {
    assert.ok(!source.includes(copy), `the lookup must not copy ${copy} into its response`);
  }

  assert.ok(source.includes("presentFields"), "it reports presence instead");
});

test("the access panel never renders a message body", () => {
  const source = readFileSync("src/components/admin/AccessRequestPanel.tsx", "utf8");

  assert.ok(!source.includes("your_message"), "the export field must not be rendered");

  /* An Error has a message too. Everything else reaching for one is
     suspect, so the owner of every .message read is checked by name. */
  const owners = [...source.matchAll(/(\w+)\.message\b/g)].map((m) => m[1]);
  for (const owner of owners) {
    assert.equal(owner, "error", `only an Error's message may be read, found ${owner}.message`);
  }

  assert.ok(source.includes("link.download"), "the export is downloaded, not displayed");
});

/* ── the audit table ──────────────────────────────────────────── */

const auditRow = (over: Record<string, unknown> = {}) => ({
  request_reference: `PR-2026-${String(900 + Math.floor(Math.random() * 99)).padStart(3, "0")}`,
  outcome: "export_completed",
  verification_method: "quoted_message",
  object_types: ["song_request"],
  object_ids: ["11111111-1111-1111-1111-111111111111"],
  formats: ["pdf", "json"],
  schema_version: SCHEMA_VERSION,
  generator_version: GENERATOR_VERSION,
  received_at: "2026-09-03T09:00:00.000Z",
  performed_by: "elliot@playingnextapp.com",
  ...over,
});

test("a completed export records what was covered, and nothing about the person", async () => {
  const { data, error } = await db
    .from("data_access_requests")
    .insert(auditRow())
    .select("*")
    .single();

  assert.equal(error, null, error?.message);
  assert.equal(data!.outcome, "export_completed");
  assert.deepEqual(data!.formats, ["pdf", "json"]);

  /*
   * performed_by is the ADMIN, and is meant to be there. Everything else
   * is checked for any trace of the subject: their words, and any
   * address-shaped string that is not the admin's own.
   */
  const { performed_by, ...rest } = data!;
  const serialised = JSON.stringify(rest);

  for (const leak of [MESSAGE, REASON, "canary", "@"]) {
    assert.ok(!serialised.includes(leak), `the audit row must not contain "${leak.slice(0, 24)}"`);
  }
  assert.equal(performed_by, "elliot@playingnextapp.com", "only the admin is named");
});

test("a completed export must carry both formats", async () => {
  for (const formats of [["pdf"], ["json"], []]) {
    const { error } = await db.from("data_access_requests").insert(auditRow({ formats }));
    assert.equal(error?.code, "23514", `formats ${JSON.stringify(formats)} should be refused`);
  }
});

test("a completed export must name its schema", async () => {
  const { error } = await db
    .from("data_access_requests")
    .insert(auditRow({ schema_version: null }));
  assert.equal(error?.code, "23514");
});

test("a refusal cannot carry record ids, formats or a schema", async () => {
  for (const over of [
    { object_ids: ["11111111-1111-1111-1111-111111111111"] },
    { object_types: ["song_request"] },
    { formats: ["pdf", "json"] },
    { schema_version: SCHEMA_VERSION },
  ]) {
    const { error } = await db.from("data_access_requests").insert(
      auditRow({
        outcome: "verification_refused",
        object_types: [],
        object_ids: [],
        formats: [],
        schema_version: null,
        ...over,
      })
    );

    assert.equal(error?.code, "23514", `a refusal carrying ${Object.keys(over)[0]} should be refused`);
  }
});

test("a bare refusal is accepted", async () => {
  const { data, error } = await db
    .from("data_access_requests")
    .insert(
      auditRow({
        outcome: "verification_refused",
        object_types: [],
        object_ids: [],
        formats: [],
        schema_version: null,
        generator_version: null,
      })
    )
    .select("outcome, object_ids, formats, schema_version")
    .single();

  assert.equal(error, null, error?.message);
  assert.deepEqual(data!.object_ids, []);
  assert.deepEqual(data!.formats, []);
  assert.equal(data!.schema_version, null);
});

test("a failed export is recorded and needs no schema", async () => {
  const { data, error } = await db
    .from("data_access_requests")
    .insert(
      auditRow({ outcome: "export_failed", formats: [], schema_version: null, generator_version: null })
    )
    .select("outcome")
    .single();

  assert.equal(error, null, error?.message);
  assert.equal(data!.outcome, "export_failed");
});

test("received_at is required, because it is the statutory clock", async () => {
  const { error } = await db.from("data_access_requests").insert(auditRow({ received_at: null }));
  assert.equal(error?.code, "23502", `expected a not-null violation, got ${error?.code}`);
});

test("the audit is append-only: no update, no delete", async () => {
  const { data } = await db.from("data_access_requests").insert(auditRow()).select("id").single();

  const updated = await db
    .from("data_access_requests")
    .update({ performed_by: "someone-else" })
    .eq("id", data!.id);
  assert.equal(updated.error?.code, "42501", `update should be refused, got ${updated.error?.code}`);

  const deleted = await db.from("data_access_requests").delete().eq("id", data!.id);
  assert.equal(deleted.error?.code, "42501", `delete should be refused, got ${deleted.error?.code}`);
});

test("an unknown outcome is refused", async () => {
  const { error } = await db.from("data_access_requests").insert(auditRow({ outcome: "exported" }));
  assert.equal(error?.code, "23514");
});

test("a malformed reference is refused", async () => {
  const { error } = await db
    .from("data_access_requests")
    .insert(auditRow({ request_reference: "elliot@playingnextapp.com" }));
  assert.equal(error?.code, "23514", "a free-text reference is where an address would end up");
});
