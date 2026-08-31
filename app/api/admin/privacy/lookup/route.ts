import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin, badRequest, serverError } from "@/src/lib/adminApi";
import { classifyRequest, classifyTip, type PaymentClass } from "@/src/lib/retention";
import {
  ERASABLE_FIELDS,
  OBJECT_LABELS,
  eligibility,
  type ErasableObjectType,
} from "@/src/lib/erasure";

/*
 * ── Finding what we hold about someone. GET only ──────────────────
 *
 * Two paths, because one is not enough. Measured on 2026-08-31: 70 of
 * 176 request rows carry no PaymentIntent and no CheckoutSession, and 8
 * of those hold a guest message. A Stripe-first workflow cannot reach
 * them, so attribute search exists for exactly the rows where personal
 * data has no financial counterweight.
 *
 * This route locates. It never authorises: see the verification step in
 * the erase route, which will not accept a match as its own proof.
 *
 * It returns field NAMES and presence, never field CONTENTS. The screen
 * that proposes erasing someone's message should not put that message on
 * one more surface, and an admin does not need to read it to erase it.
 *
 * GET only, so the route cannot mutate anything whatever verb is thrown
 * at it - Next returns 405 for a method with no exported handler.
 */

type Candidate = {
  objectType: ErasableObjectType;
  objectId: string;
  label: string;
  /** Human context to pick the right row. No personal data. */
  context: string;
  createdAt: string;
  classification: PaymentClass;
  presentFields: string[];
  eligible: boolean;
  fields: string[];
  retained: string;
  reason: string;
};

const present = (row: Record<string, unknown>, fields: string[]) =>
  fields.filter((f) => {
    const v = row[f];
    return typeof v === "string" ? v.trim().length > 0 : v != null;
  });

function describeRequest(r: Record<string, unknown>) {
  const song = [r.song_title, r.artist].filter(Boolean).join(" — ");
  return `${song || "Untitled"} · ${String(r.request_status)}`;
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const reference = url.searchParams.get("reference")?.trim() ?? "";
  const djId = url.searchParams.get("dj")?.trim() ?? "";
  const from = url.searchParams.get("from")?.trim() ?? "";
  const to = url.searchParams.get("to")?.trim() ?? "";
  const song = url.searchParams.get("song")?.trim() ?? "";

  const byReference = reference.length > 0;
  const byAttributes = djId.length > 0 || song.length > 0 || from.length > 0;

  if (!byReference && !byAttributes) {
    return badRequest(
      "Give a Stripe reference, or a DJ and a date range to search."
    );
  }

  try {
    const candidates: Candidate[] = [];

    /* Reports are needed to classify a request honestly either way. */
    const reportsResult = await supabaseAdmin
      .from("not_played_reports")
      .select("id, song_request_id, reason, resolution, created_at");
    if (reportsResult.error) {
      return serverError("Privacy lookup: reports error:", reportsResult.error);
    }
    const reports = reportsResult.data ?? [];
    const reportedIds = new Set<string>(
      reports.map((r) => r.song_request_id as string)
    );

    const requestCols =
      "id, request_status, message, created_at, song_title, artist, dj_profile_id, stripe_payment_intent_id, stripe_checkout_session_id, stripe_fee, reported_not_played_at";
    const tipCols =
      "id, status, message, created_at, dj_profile_id, stripe_payment_intent_id, stripe_checkout_session_id, stripe_fee";

    if (byReference) {
      /*
       * A Stripe reference may be a PaymentIntent or a Checkout Session,
       * and the admin should not have to know which. Both columns are
       * tried on every payment-bearing table.
       */
      const [reqPi, reqCs, tipPi, tipCs, box] = await Promise.all([
        supabaseAdmin.from("song_requests").select(requestCols).eq("stripe_payment_intent_id", reference),
        supabaseAdmin.from("song_requests").select(requestCols).eq("stripe_checkout_session_id", reference),
        supabaseAdmin.from("tips").select(tipCols).eq("stripe_payment_intent_id", reference),
        supabaseAdmin.from("tips").select(tipCols).eq("stripe_checkout_session_id", reference),
        supabaseAdmin
          .from("qr_box_orders")
          .select(
            "id, status, created_at, recipient_name, address_line1, address_line2, city, postcode, country, stripe_payment_intent_id"
          )
          .eq("stripe_payment_intent_id", reference),
      ]);

      for (const res of [reqPi, reqCs, tipPi, tipCs, box]) {
        if (res.error) {
          return serverError("Privacy lookup: reference error:", res.error);
        }
      }

      const seen = new Set<string>();
      for (const r of [...(reqPi.data ?? []), ...(reqCs.data ?? [])]) {
        if (seen.has(r.id as string)) continue;
        seen.add(r.id as string);
        const cls = classifyRequest(r as never, reportedIds);
        const p = present(r, ERASABLE_FIELDS.song_request);
        const e = eligibility({ objectType: "song_request", presentFields: p, classification: cls });
        candidates.push({
          objectType: "song_request",
          objectId: r.id as string,
          label: OBJECT_LABELS.song_request,
          context: describeRequest(r),
          createdAt: r.created_at as string,
          classification: cls,
          presentFields: p,
          ...e,
        });
      }
      for (const r of [...(tipPi.data ?? []), ...(tipCs.data ?? [])]) {
        if (seen.has(r.id as string)) continue;
        seen.add(r.id as string);
        const cls = classifyTip(r as never);
        const p = present(r, ERASABLE_FIELDS.tip);
        const e = eligibility({ objectType: "tip", presentFields: p, classification: cls });
        candidates.push({
          objectType: "tip",
          objectId: r.id as string,
          label: OBJECT_LABELS.tip,
          context: `Tip · ${String(r.status)}`,
          createdAt: r.created_at as string,
          classification: cls,
          presentFields: p,
          ...e,
        });
      }
      for (const r of box.data ?? []) {
        const p = present(r, ERASABLE_FIELDS.qr_box_order);
        const cls: PaymentClass =
          r.stripe_payment_intent_id == null && r.status === "pending_payment"
            ? "never_charged"
            : "preserve";
        const e = eligibility({
          objectType: "qr_box_order",
          presentFields: p,
          classification: cls,
          orderStatus: r.status as string,
        });
        candidates.push({
          objectType: "qr_box_order",
          objectId: r.id as string,
          label: OBJECT_LABELS.qr_box_order,
          context: `QR box order · ${String(r.status)}`,
          createdAt: r.created_at as string,
          classification: cls,
          presentFields: p,
          ...e,
        });
      }
    } else {
      /*
       * Attribute search. Deliberately capped and deliberately narrow:
       * it exists to produce a short list a human then identifies, not
       * to sweep the table. A DJ plus a calendar day averages 2 rows in
       * the real data but the busiest day holds 30, so the song filter
       * matters.
       */
      let q = supabaseAdmin.from("song_requests").select(requestCols).order("created_at", { ascending: false }).limit(50);
      if (djId) q = q.eq("dj_profile_id", djId);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      if (song) q = q.ilike("song_title", `%${song}%`);

      const result = await q;
      if (result.error) {
        return serverError("Privacy lookup: attribute error:", result.error);
      }
      for (const r of result.data ?? []) {
        const cls = classifyRequest(r as never, reportedIds);
        const p = present(r, ERASABLE_FIELDS.song_request);
        const e = eligibility({ objectType: "song_request", presentFields: p, classification: cls });
        candidates.push({
          objectType: "song_request",
          objectId: r.id as string,
          label: OBJECT_LABELS.song_request,
          context: describeRequest(r),
          createdAt: r.created_at as string,
          classification: cls,
          presentFields: p,
          ...e,
        });
      }
    }

    candidates.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({
      mode: byReference ? "reference" : "attributes",
      /* Stated so the UI can refuse to treat a match as authorisation. */
      authorises: false,
      candidates,
      count: candidates.length,
    });
  } catch (error) {
    return serverError("Privacy lookup error:", error);
  }
}
