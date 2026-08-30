import { NextRequest, NextResponse } from "next/server";
import {
  supabaseAdmin,
  requireAdmin,
  badRequest,
  serverError,
} from "@/src/lib/adminApi";

/*
 * ── Tasks: the things Elliot has to do ────────────────────────────
 *
 * A task is an action of his. Awaiting a reply, a venue refusal,
 * incomplete onboarding and readiness to activate are NOT tasks - they
 * are state the CRM already derives or stores, and turning them into
 * tasks produced a list of things that could not be completed. That
 * conflation is what made the old Mark done meaningless.
 *
 * Each verb touches the smallest possible set of columns:
 *
 *   complete    completed_at only. Never last_contact_at, never a note,
 *               never the blocker. Ticking something off is not contact.
 *   reopen      completed_at back to null. The row was never destroyed.
 *   reschedule  due_at only.
 *   unschedule  due_at to null. An unscheduled task is still a task.
 *   edit        title and/or due_at.
 *   delete      removes the row, for tasks that should not exist. The
 *               UI confirms first, because complete and delete mean
 *               opposite things: one keeps the history, one erases it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * Explicit allowlist, built field by field. Spreading the request body
 * is how a write path silently widens - the same failure as the select
 * string that took the guest page down, with the arrow reversed.
 */
function buildPayload(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, string | null> = {};

  if (!partial || "title" in body) {
    const title = body.title;
    if (typeof title !== "string" || !title.trim()) {
      return { error: "A task needs a title.", payload: null };
    }
    out.title = title.trim().slice(0, 300);
  }

  /* due_at and completed_at are explicitly nullable: passing null is a
     real instruction (unschedule, reopen), not a missing value. */
  for (const key of ["due_at", "completed_at"] as const) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value === null || value === "") {
      out[key] = null;
      continue;
    }
    if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
      return { error: `${key.replace("_", " ")} is not a valid date.`, payload: null };
    }
    out[key] = value;
  }

  return { error: null, payload: out };
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const contactId = new URL(request.url).searchParams.get("contact_id");

    const query = supabaseAdmin
      .from("crm_tasks")
      .select("*")
      /* Open first, then soonest due. Nulls last so unscheduled tasks
         sit below dated ones rather than jumping to the top. */
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (contactId) {
      if (!UUID.test(contactId)) return badRequest("Invalid contact id.");
      query.eq("contact_id", contactId);
    }

    const { data, error } = await query;
    if (error) return serverError("CRM tasks load error:", error);

    return NextResponse.json({ tasks: data ?? [] });
  } catch (error) {
    return serverError("CRM tasks route error:", error);
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

    const { error: invalid, payload } = buildPayload(body, false);
    if (invalid || !payload) return badRequest(invalid ?? "Invalid task.");

    const { data, error } = await supabaseAdmin
      .from("crm_tasks")
      .insert({ ...payload, contact_id: contactId })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.code === "23503"
              ? "That contact no longer exists."
              : "Unable to create this task.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ task: data });
  } catch (error) {
    return serverError("CRM task create error:", error);
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const id = body.id;
    if (typeof id !== "string" || !UUID.test(id)) {
      return badRequest("A task id is required.");
    }

    const { error: invalid, payload } = buildPayload(body, true);
    if (invalid || !payload) return badRequest(invalid ?? "Invalid task.");
    if (Object.keys(payload).length === 0) return badRequest("Nothing to update.");

    /*
     * contact_id is deliberately not writable. Moving a task between
     * people is not an edit, it is a different task - and allowing it
     * would let a completed task's history silently change owner.
     */
    const { data, error } = await supabaseAdmin
      .from("crm_tasks")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return serverError("CRM task update error:", error);
    return NextResponse.json({ task: data });
  } catch (error) {
    return serverError("CRM task update error:", error);
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !UUID.test(id)) return badRequest("A task id is required.");

    const { error } = await supabaseAdmin.from("crm_tasks").delete().eq("id", id);
    if (error) return serverError("CRM task delete error:", error);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("CRM task delete error:", error);
  }
}
