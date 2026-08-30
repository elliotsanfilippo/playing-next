import { NextRequest, NextResponse } from "next/server";
import {
  supabaseAdmin,
  requireAdmin,
  badRequest,
  serverError,
} from "@/src/lib/adminApi";

/*
 * ── Dated notes against a contact ─────────────────────────────────
 *
 * occurred_at is separate from created_at so a conversation can be
 * written up days later without the log claiming it happened then. The
 * UI defaults occurred_at to now and lets it be backdated; created_at is
 * never writable.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const contactId = new URL(request.url).searchParams.get("contact_id");

    const query = supabaseAdmin
      .from("crm_notes")
      .select("*")
      .order("occurred_at", { ascending: false });

    if (contactId) {
      if (!UUID.test(contactId)) return badRequest("Invalid contact id.");
      query.eq("contact_id", contactId);
    }

    const { data, error } = await query;
    if (error) return serverError("CRM notes load error:", error);

    return NextResponse.json({ notes: data ?? [] });
  } catch (error) {
    return serverError("CRM notes route error:", error);
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await request.json();

    const contactId = body.contact_id;
    if (typeof contactId !== "string" || !UUID.test(contactId)) {
      return badRequest("A contact is required.");
    }

    const text = body.body;
    if (typeof text !== "string" || !text.trim()) {
      return badRequest("A note cannot be empty.");
    }

    const payload: Record<string, string> = {
      contact_id: contactId,
      body: text.trim().slice(0, 4000),
    };

    if (typeof body.occurred_at === "string" && body.occurred_at) {
      if (Number.isNaN(new Date(body.occurred_at).getTime())) {
        return badRequest("That is not a valid date.");
      }
      payload.occurred_at = body.occurred_at;
    }

    const { data, error } = await supabaseAdmin
      .from("crm_notes")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      /* 23503 means the contact was deleted between opening the drawer
         and saving the note, which is worth saying plainly rather than
         reporting as a generic failure. */
      return NextResponse.json(
        {
          error:
            error.code === "23503"
              ? "That contact no longer exists."
              : "Unable to save this note.",
        },
        { status: 400 }
      );
    }

    /*
     * Only a real interaction advances last_contact_at.
     *
     * The caller says which this is. Logging an interaction means
     * something happened between us and passes true; adding a
     * historical note is recording context and passes false. Writing a
     * note used to always advance the date, which invented contact
     * dates for three contacts during the GROWTH_CRM import and had to
     * be reverted by hand.
     *
     * Defaults to false: a caller that has not thought about it should
     * not silently claim you spoke to someone.
     */
    if (body.advance_last_contact !== true) {
      return NextResponse.json({ note: data });
    }

    const occurred = data.occurred_at as string;
    const { data: contact } = await supabaseAdmin
      .from("crm_contacts")
      .select("last_contact_at")
      .eq("id", contactId)
      .single();

    const previous = contact?.last_contact_at
      ? new Date(contact.last_contact_at).getTime()
      : 0;

    if (new Date(occurred).getTime() > previous) {
      await supabaseAdmin
        .from("crm_contacts")
        .update({ last_contact_at: occurred })
        .eq("id", contactId);
    }

    return NextResponse.json({ note: data });
  } catch (error) {
    return serverError("CRM note create error:", error);
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !UUID.test(id)) return badRequest("A note id is required.");

    const { error } = await supabaseAdmin.from("crm_notes").delete().eq("id", id);
    if (error) return serverError("CRM note delete error:", error);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("CRM note delete error:", error);
  }
}
