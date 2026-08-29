import { NextRequest, NextResponse } from "next/server";
import {
  supabaseAdmin,
  requireAdmin,
  badRequest,
  serverError,
} from "@/src/lib/adminApi";
import { isActivationBlocker, isOutreachStatus } from "@/src/lib/crmTaxonomy";

/*
 * ── CRM contacts: the human half of the funnel ────────────────────
 *
 * Everything objective about a DJ (onboarded, payments ready, activated,
 * repeat, Pro) is derived from dj_profiles and song_requests by
 * src/lib/djLifecycle.ts and is deliberately NOT writable here. This
 * route only ever touches what a person knows and a database cannot:
 * who they are, what was said, what is blocking them, when to follow up.
 *
 * If a field here ever starts to duplicate something derivable, that is
 * the bug, not a convenience.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * An explicit allowlist, built field by field, rather than spreading the
 * request body. The guest-page outage of 2026-09-03 came from a select
 * string that silently widened; a write path that spreads whatever JSON
 * arrives is the same failure with the arrow reversed. Anything not
 * named here cannot be written, including columns that do not exist yet.
 */
type Writable = Record<string, string | null>;

function buildPayload(body: Record<string, unknown>, partial: boolean) {
  const out: Writable = {};
  const err = (m: string) => ({ error: m, payload: null });

  const text = (key: string, max: number) => {
    if (!(key in body)) return;
    const v = body[key];
    if (v === null || v === "") { out[key] = null; return; }
    if (typeof v !== "string") throw new Error(`${key} must be text.`);
    out[key] = v.trim().slice(0, max);
  };

  if (!partial || "display_name" in body) {
    const name = body.display_name;
    if (typeof name !== "string" || !name.trim()) {
      return err("A name is required.");
    }
    out.display_name = name.trim().slice(0, 120);
  }

  try {
    text("contact_channel", 40);
    text("contact_handle", 200);
    text("acquisition_source", 80);
    text("next_action", 500);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Invalid field.");
  }

  if ("outreach_status" in body) {
    if (!isOutreachStatus(body.outreach_status)) {
      return err("That outreach status is not one of the allowed values.");
    }
    out.outreach_status = body.outreach_status;
  }

  if ("activation_blocker" in body) {
    const v = body.activation_blocker;
    if (v === null || v === "") {
      out.activation_blocker = null;
    } else if (!isActivationBlocker(v)) {
      return err("That blocker is not one of the allowed values.");
    } else {
      out.activation_blocker = v;
    }
  }

  /* Dates are passed straight to Postgres, which is stricter than any
     check written here would be, but an obviously wrong shape is worth
     rejecting with a sentence rather than a 22007. */
  for (const key of ["next_gig_date", "last_contact_at", "next_follow_up_at"]) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === null || v === "") { out[key] = null; continue; }
    if (typeof v !== "string" || Number.isNaN(new Date(v).getTime())) {
      return err(`${key.replace(/_/g, " ")} is not a valid date.`);
    }
    out[key] = v;
  }

  if ("dj_profile_id" in body) {
    const v = body.dj_profile_id;
    if (v === null || v === "") {
      out.dj_profile_id = null;
    } else if (typeof v !== "string" || !UUID.test(v)) {
      return err("That is not a valid DJ profile id.");
    } else {
      out.dj_profile_id = v;
    }
  }

  return { error: null, payload: out };
}

/* Postgres speaks first; these turn its codes into something an admin
   can act on. 23505 is the one that matters: it is the UNIQUE on
   dj_profile_id refusing to let two contacts claim the same DJ. */
function friendly(code: string | undefined, fallback: string) {
  if (code === "23505") return "That DJ is already linked to another contact.";
  if (code === "23514") return "That value is not allowed for this field.";
  if (code === "23503") return "That DJ profile no longer exists.";
  return fallback;
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const { data, error } = await supabaseAdmin
      .from("crm_contacts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return serverError("CRM contacts load error:", error);
    return NextResponse.json({ contacts: data ?? [] });
  } catch (error) {
    return serverError("CRM contacts route error:", error);
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { error: invalid, payload } = buildPayload(body, false);
    if (invalid || !payload) return badRequest(invalid ?? "Invalid contact.");

    const { data, error } = await supabaseAdmin
      .from("crm_contacts")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: friendly(error.code, "Unable to create this contact.") },
        { status: error.code === "23505" ? 409 : 400 }
      );
    }

    return NextResponse.json({ contact: data });
  } catch (error) {
    return serverError("CRM contact create error:", error);
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const id = body.id;
    if (typeof id !== "string" || !UUID.test(id)) {
      return badRequest("A contact id is required.");
    }

    const { error: invalid, payload } = buildPayload(body, true);
    if (invalid || !payload) return badRequest(invalid ?? "Invalid contact.");
    if (Object.keys(payload).length === 0) {
      return badRequest("Nothing to update.");
    }

    const { data, error } = await supabaseAdmin
      .from("crm_contacts")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: friendly(error.code, "Unable to update this contact.") },
        { status: error.code === "23505" ? 409 : 400 }
      );
    }

    return NextResponse.json({ contact: data });
  } catch (error) {
    return serverError("CRM contact update error:", error);
  }
}

/*
 * Deleting a contact cascades its notes, which is the intended shape:
 * the notes are about the relationship and have no meaning without it.
 * Nothing about the DJ's account is touched, because nothing about the
 * DJ's account lives here.
 */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !UUID.test(id)) return badRequest("A contact id is required.");

    const { error } = await supabaseAdmin
      .from("crm_contacts")
      .delete()
      .eq("id", id);

    if (error) return serverError("CRM contact delete error:", error);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("CRM contact delete error:", error);
  }
}
