import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireAdminUser, badRequest } from "@/src/lib/adminApi";
import { isVerificationMethod, isValidRequestReference } from "@/src/lib/erasure";
import {
  buildExportJson,
  renderExportPdf,
  EXPORT_FORMATS,
  SCHEMA_VERSION,
  GENERATOR_VERSION,
  type ExportRecord,
  type ExportSnapshot,
} from "@/src/lib/privacyExport";

/*
 * ── Answering an access request ───────────────────────────────────
 *
 * Admin-only. There is no public endpoint and no guest login, and the
 * recipient is never named here: the admin replies on the mail thread
 * the request arrived in, so no guest address ever reaches Supabase.
 *
 * The order is load-bearing:
 *
 *     generate  →  write the audit row  →  return the files
 *
 * If the audit insert fails, the caller gets an error and NO file. That
 * is the erasure lesson inverted: there, an audit row must never claim
 * an erasure that did not happen; here, a disclosure must never happen
 * without a record of it. A crash midway writes nothing at all, which is
 * correct, because nothing was produced and nothing was disclosed.
 *
 * There is no execution flag. Admin authentication plus recorded
 * verification is the gate, decided 2026-09-03.
 *
 * Scope is the VERIFIED records and only those. The caller passes the
 * object ids that ownership was proven for; this route never widens that
 * to "everything that looks like the same person", because no identifier
 * links a guest's records and guessing would disclose someone else's
 * message.
 */

type Requested = { type: string; id: string };

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function POST(request: NextRequest) {
  const { denied, user } = await requireAdminUser(request);
  if (denied) return denied;

  let body: {
    outcome?: unknown;
    requestReference?: unknown;
    verificationMethod?: unknown;
    receivedAt?: unknown;
    objects?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest("Expected a JSON body.");
  }

  const reference =
    typeof body.requestReference === "string" && body.requestReference.trim().length > 0
      ? body.requestReference.trim()
      : null;

  if (reference !== null && !isValidRequestReference(reference)) {
    return badRequest("A reference must look like PR-2026-001.");
  }

  const receivedAt = typeof body.receivedAt === "string" ? body.receivedAt : "";

  if (!receivedAt || Number.isNaN(Date.parse(receivedAt))) {
    return badRequest("Record when the request was received before continuing.");
  }

  const performedBy = user.email ?? user.id;

  /* ── the refusal path ──────────────────────────────────────────
   *
   * A bare row. No object ids, no formats, no schema: the database
   * enforces that too, so this cannot drift into a record of a person we
   * could not identify.
   */
  if (body.outcome === "verification_refused") {
    const method = isVerificationMethod(body.verificationMethod) ? body.verificationMethod : null;

    const { error } = await supabaseAdmin.from("data_access_requests").insert({
      request_reference: reference,
      outcome: "verification_refused",
      verification_method: method,
      received_at: receivedAt,
      performed_by: performedBy,
    });

    if (error) {
      console.error("Privacy export: refusal audit failed:", error.message);
      return NextResponse.json({ error: "Could not record the refusal." }, { status: 500 });
    }

    return NextResponse.json({ recorded: "verification_refused" });
  }

  /* ── the export path ─────────────────────────────────────────── */

  if (!isVerificationMethod(body.verificationMethod)) {
    return badRequest("Record how ownership was verified before exporting anything.");
  }

  const verificationMethod = body.verificationMethod;
  const requested: Requested[] = Array.isArray(body.objects)
    ? (body.objects as Requested[]).filter(
        (o) => o && typeof o.type === "string" && isUuid(o.id)
      )
    : [];

  /* A nil return is a valid, complete answer: we hold nothing, and
     saying so is the response. It still produces both artefacts and a
     completed audit row with no object ids. */

  const generatedAt = new Date().toISOString();
  const appCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  const auditFailure = async (message: string) => {
    const { error } = await supabaseAdmin.from("data_access_requests").insert({
      request_reference: reference,
      outcome: "export_failed",
      verification_method: verificationMethod,
      object_types: [...new Set(requested.map((o) => o.type))],
      object_ids: requested.map((o) => o.id),
      received_at: receivedAt,
      performed_by: performedBy,
    });

    if (error) console.error("Privacy export: failure audit failed:", error.message);

    return NextResponse.json({ error: message }, { status: 500 });
  };

  let records: ExportRecord[];

  try {
    const wanted = (type: string) => requested.filter((o) => o.type === type).map((o) => o.id);

    const requestIds = wanted("song_request");
    const tipIds = wanted("tip");
    const reportIds = wanted("not_played_report");

    const [reqRes, tipRes, repRes] = await Promise.all([
      requestIds.length
        ? supabaseAdmin
            .from("song_requests")
            .select(
              "id, created_at, message, song_title, artist, request_status, currency, total_amount, guest_service_fee, dj_profile_id"
            )
            .in("id", requestIds)
        : Promise.resolve({ data: [], error: null }),
      tipIds.length
        ? supabaseAdmin
            .from("tips")
            .select("id, created_at, message, status, currency, total_amount, guest_service_fee, dj_profile_id")
            .in("id", tipIds)
        : Promise.resolve({ data: [], error: null }),
      reportIds.length
        ? supabaseAdmin
            .from("not_played_reports")
            .select("id, created_at, reason, resolution, song_request_id")
            .in("id", reportIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const res of [reqRes, tipRes, repRes]) {
      if (res.error) throw new Error(res.error.message);
    }

    /* One DJ lookup for names, so the document reads like a person
       wrote it rather than listing slugs. */
    const djIds = [
      ...new Set(
        [...(reqRes.data ?? []), ...(tipRes.data ?? [])]
          .map((r) => (r as { dj_profile_id?: string }).dj_profile_id)
          .filter((v): v is string => !!v)
      ),
    ];

    const djs = djIds.length
      ? (await supabaseAdmin.from("dj_profiles").select("id, dj_name, slug").in("id", djIds)).data ?? []
      : [];

    const djFor = (id: string | undefined) => djs.find((d) => d.id === id);

    records = [
      ...(reqRes.data ?? []).map((r): ExportRecord => {
        const dj = djFor((r as { dj_profile_id?: string }).dj_profile_id);
        return {
          type: "song_request",
          id: r.id as string,
          created_at: r.created_at as string,
          dj_name: dj?.dj_name ?? null,
          dj_slug: dj?.slug ?? null,
          song_title: (r.song_title as string) ?? null,
          artist: (r.artist as string) ?? null,
          message: (r.message as string) ?? null,
          status: r.request_status as string,
          /* From our own data only. Stripe is never called here. */
          refunded: r.request_status === "refunded",
          currency: (r.currency as string) ?? null,
          total_paid: (r.total_amount as number) ?? null,
          guest_service_fee: (r.guest_service_fee as number) ?? null,
        };
      }),
      ...(tipRes.data ?? []).map((r): ExportRecord => {
        const dj = djFor((r as { dj_profile_id?: string }).dj_profile_id);
        return {
          type: "tip",
          id: r.id as string,
          created_at: r.created_at as string,
          dj_name: dj?.dj_name ?? null,
          dj_slug: dj?.slug ?? null,
          message: (r.message as string) ?? null,
          status: r.status as string,
          refunded: r.status === "refunded",
          currency: (r.currency as string) ?? null,
          total_paid: (r.total_amount as number) ?? null,
          guest_service_fee: (r.guest_service_fee as number) ?? null,
        };
      }),
      ...(repRes.data ?? []).map(
        (r): ExportRecord => ({
          type: "not_played_report",
          id: r.id as string,
          created_at: r.created_at as string,
          reason: (r.reason as string) ?? null,
          song_request_id: (r.song_request_id as string) ?? null,
          resolution: (r.resolution as string) ?? null,
        })
      ),
    ];
  } catch (error) {
    console.error("Privacy export: snapshot failed:", error);
    return auditFailure("Could not read the records for this export.");
  }

  /* ── one snapshot, two artefacts ── */
  const snapshot: ExportSnapshot = {
    requestReference: reference,
    verificationMethod,
    generatedAt,
    appCommit,
    records,
  };

  let json: ReturnType<typeof buildExportJson>;
  let pdf: Buffer;

  try {
    json = buildExportJson(snapshot);
    pdf = await renderExportPdf(snapshot);
  } catch (error) {
    console.error("Privacy export: generation failed:", error);
    return auditFailure("Could not generate the export.");
  }

  /*
   * The audit goes in BEFORE the files come out. If this fails, the
   * admin gets an error and no document, so nobody ends up holding an
   * export that was never recorded.
   */
  const { error: auditError } = await supabaseAdmin.from("data_access_requests").insert({
    request_reference: reference,
    outcome: "export_completed",
    verification_method: verificationMethod,
    object_types: [...new Set(records.map((r) => r.type))],
    object_ids: records.map((r) => r.id),
    formats: [...EXPORT_FORMATS],
    schema_version: SCHEMA_VERSION,
    generator_version: GENERATOR_VERSION,
    received_at: receivedAt,
    performed_by: performedBy,
  });

  if (auditError) {
    console.error("Privacy export: audit insert failed:", auditError.message);
    return NextResponse.json(
      { error: "The export was not recorded, so it has not been released." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    reference,
    generatedAt,
    totals: json.totals,
    json,
    pdfBase64: pdf.toString("base64"),
  });
}
