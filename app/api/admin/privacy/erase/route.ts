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
 *   fields_cleared   returned by the database, being what it really
 *                    cleared - not what this route asked for
 *   row_deleted      written as false by the function; there is no code
 *                    path here or there that deletes a row
 *
 * The client supplies only which record, which proof was accepted, and
 * the request reference. Everything else it might claim is ignored.
 *
 * ── One transaction, not two statements ───────────────────────────
 *
 * This route used to insert the audit row and then clear the field. A
 * failure between them left an immutable record asserting an erasure
 * that never happened, and because data_erasures is append-only that
 * false record could never be corrected. Reversing the order is worse:
 * the data would be gone with no evidence of who removed it.
 *
 * Neither order is safe, because the order was never the problem. Both
 * writes now happen inside erase_personal_fields, a plpgsql function
 * whose body is a single transaction - see
 * supabase/migrations/20260831_erase_atomically.sql. Either the field is
 * cleared and the erasure recorded, or nothing happened at all.
 *
 * The eligibility checks below stay, even though the function enforces
 * its own. They exist to produce a readable refusal; the function exists
 * so that a bug in this file cannot clear a live delivery address.
 */

/* Read only - the clearing itself happens inside the transaction. */
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
     * One call, one transaction. The function clears the fields and
     * writes the audit row together, and returns what it actually
     * cleared so the response cannot claim more than happened.
     */
    const { data: erased, error: rpcError } = await supabaseAdmin.rpc(
      "erase_personal_fields",
      {
        p_object_type: objectType,
        p_object_id: objectId,
        p_classification: classification,
        p_performed_by: user.email ?? user.id,
        p_request_reference: reference,
      }
    );

    if (rpcError) {
      /*
       * P0002 is the function's own "nothing to erase" - the field was
       * already empty, or the row was not eligible. Not an error worth a
       * 500, and importantly not an erasure: no audit row was written,
       * because a repeated request did not erase anything the first one
       * had not already removed.
       */
      if (rpcError.code === "P0002") {
        return NextResponse.json(
          {
            error:
              "There was nothing left to erase on that record. Nothing was changed and no erasure was recorded.",
            erased: [],
          },
          { status: 409 }
        );
      }
      return serverError("Erasure: transaction error:", rpcError);
    }

    const fields: string[] =
      (Array.isArray(erased) ? erased[0]?.fields_cleared : null) ?? [];

    return NextResponse.json({
      erased: fields,
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
