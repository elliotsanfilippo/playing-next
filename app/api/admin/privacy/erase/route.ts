import { NextRequest, NextResponse } from "next/server";
import {
  supabaseAdmin,
  requireAdminUser,
  badRequest,
  serverError,
} from "@/src/lib/adminApi";
import { classifyRequest, classifyTip, type PaymentClass } from "@/src/lib/retention";
import {
  ERASABLE_FIELDS,
  ERASABLE_OBJECT_TYPES,
  eligibility,
  isValidRequestReference,
  isVerificationMethod,
  type ErasableObjectType,
} from "@/src/lib/erasure";
import { ERASURE_EXECUTION_ENABLED } from "@/src/lib/erasureConfig";

/*
 * ── The erasure write ─────────────────────────────────────────────
 *
 * Every fact recorded in the audit log is established HERE, on the
 * server, from the row itself. Nothing that decides what happens or what
 * gets written comes from the request body:
 *
 *   performed_by     the verified admin session, never the payload
 *   performed_at     the database default
 *   classification   recomputed from the freshly-read row
 *   fields_cleared   the fields this route actually nulled
 *   row_deleted      hard-coded false, because manual erasure never
 *                    deletes a row - see the migration comment
 *
 * The client supplies only which record, which proof was accepted, and
 * the request reference. Everything else it might claim is ignored.
 *
 * Order matters: the audit row is written BEFORE the clearing update. An
 * erasure that fails halfway is then still visible and repeatable, which
 * is the safer of the two failure modes. The reverse - clear first, log
 * second - can erase data and leave no evidence it happened.
 */

const TABLE: Record<ErasableObjectType, string> = {
  song_request: "song_requests",
  tip: "tips",
  not_played_report: "not_played_reports",
  qr_box_order: "qr_box_orders",
};

export async function POST(request: NextRequest) {
  const { denied, user } = await requireAdminUser(request);
  if (denied) return denied;

  /*
   * Disabled by default. Lookup is not gated - reading what we hold is
   * safe and useful - but the irreversible write waits for review and
   * for backups, exactly like the retention executor.
   */
  if (!ERASURE_EXECUTION_ENABLED) {
    return NextResponse.json(
      {
        error:
          "Erasure execution is disabled. The workflow is built and reviewable; enabling it is a deliberate decision.",
        executionEnabled: false,
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const objectType = body?.objectType;
    const objectId = body?.objectId;
    const verification = body?.verificationMethod;
    const reference = body?.requestReference ?? null;

    if (!ERASABLE_OBJECT_TYPES.includes(objectType)) {
      return badRequest("That is not a record type erasure can act on.");
    }
    if (typeof objectId !== "string" || objectId.length < 10) {
      return badRequest("A record id is required.");
    }
    /*
     * Verification is mandatory and attribute matching is not one of the
     * accepted values. Finding a row does not entitle anyone to erase
     * it: a stranger who was at the gig can name the DJ, the date and
     * the song.
     */
    if (!isVerificationMethod(verification)) {
      return badRequest(
        "Record how ownership was verified before erasing anything."
      );
    }
    /* Mirrors the CHECK constraint, so the admin sees a sentence rather
       than a 23514 from Postgres. */
    if (reference !== null && !isValidRequestReference(reference)) {
      return badRequest(
        "The privacy-request reference must look like PR-2026-001."
      );
    }

    const table = TABLE[objectType as ErasableObjectType];

    /* Read the row fresh. The client's idea of it is not evidence. */
    const { data: row, error: readError } = await supabaseAdmin
      .from(table)
      .select("*")
      .eq("id", objectId)
      .maybeSingle();

    if (readError) return serverError("Erasure: read error:", readError);
    if (!row) return badRequest("That record no longer exists.");

    /* Classification is computed here, never accepted from the caller. */
    let classification: PaymentClass;
    if (objectType === "song_request") {
      const { data: reports, error } = await supabaseAdmin
        .from("not_played_reports")
        .select("song_request_id");
      if (error) return serverError("Erasure: reports error:", error);
      classification = classifyRequest(
        row as never,
        new Set((reports ?? []).map((r) => r.song_request_id as string))
      );
    } else if (objectType === "tip") {
      classification = classifyTip(row as never);
    } else if (objectType === "qr_box_order") {
      classification =
        row.stripe_payment_intent_id == null && row.status === "pending_payment"
          ? "never_charged"
          : "preserve";
    } else {
      /* A report row is kept whatever happens; only its reason goes. */
      classification = "preserve";
    }

    const all = ERASABLE_FIELDS[objectType as ErasableObjectType];
    const presentFields = all.filter((f) => {
      const v = (row as Record<string, unknown>)[f];
      return typeof v === "string" ? v.trim().length > 0 : v != null;
    });

    const decision = eligibility({
      objectType: objectType as ErasableObjectType,
      presentFields,
      classification,
      orderStatus: (row as Record<string, unknown>).status as string | null,
    });

    if (!decision.eligible) {
      return NextResponse.json(
        { error: decision.reason, eligible: false },
        { status: 409 }
      );
    }

    /*
     * The audit row first, so a failure between here and the update
     * leaves evidence rather than a silent gap. row_deleted is written
     * as a literal false: this route has no code path that deletes.
     */
    const { error: auditError } = await supabaseAdmin
      .from("data_erasures")
      .insert({
        object_type: objectType,
        object_id: objectId,
        fields_cleared: decision.fields,
        row_deleted: false,
        classification,
        request_reference: reference,
        performed_by: user.email ?? user.id,
      });

    if (auditError) return serverError("Erasure: audit write error:", auditError);

    /* Only the named fields, set to null. No other column is touched. */
    const patch: Record<string, null> = {};
    for (const f of decision.fields) patch[f] = null;

    const { error: clearError } = await supabaseAdmin
      .from(table)
      .update(patch)
      .eq("id", objectId);

    if (clearError) return serverError("Erasure: clear error:", clearError);

    return NextResponse.json({
      erased: decision.fields,
      retained: decision.retained,
      classification,
      verification,
      requestReference: reference,
      performedBy: user.email ?? user.id,
    });
  } catch (error) {
    return serverError("Erasure route error:", error);
  }
}
