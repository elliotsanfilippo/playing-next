import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin, serverError } from "@/src/lib/adminApi";

/*
 * ── Prospects a new signup could turn out to be ───────────────────
 *
 * The mirror of unlinked-djs, for the other direction. That route
 * answers "which accounts has no contact claimed"; this one answers
 * "which people in the CRM have no account yet", so a signup arriving
 * in the New signups inbox can be reconciled from either side.
 *
 * Deliberately no fuzzy matching, no scoring and no email comparison,
 * exactly as in unlinked-djs. Linking is a claim about identity and a
 * human makes it explicitly. The search box in the UI filters this list
 * on text the admin types; nothing here ranks or suggests.
 *
 * The note and task counts are the point of the extra work. Linking
 * carries a prospect's whole history onto the account, and a picker
 * that showed only names would ask you to pick between two similar ones
 * without telling you which carries three conversations and an open
 * task. They are counts of what will be preserved, not decoration.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const [contactsResult, notesResult, tasksResult] = await Promise.all([
      supabaseAdmin
        .from("crm_contacts")
        .select(
          "id, display_name, outreach_status, contact_channel, contact_handle, activation_blocker, last_contact_at, created_at"
        )
        .is("dj_profile_id", null)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("crm_notes").select("contact_id"),
      supabaseAdmin.from("crm_tasks").select("contact_id, completed_at"),
    ]);

    if (contactsResult.error) {
      return serverError("Unlinked contacts load error:", contactsResult.error);
    }
    /*
     * A failed count must not silently render as zero. "No notes" and
     * "we could not count the notes" are different answers, and the
     * second one should stop the request rather than quietly understate
     * what a link is about to carry across.
     */
    if (notesResult.error) {
      return serverError("Unlinked contacts note count error:", notesResult.error);
    }
    if (tasksResult.error) {
      return serverError("Unlinked contacts task count error:", tasksResult.error);
    }

    const noteCounts = new Map<string, number>();
    for (const note of notesResult.data ?? []) {
      const id = note.contact_id as string;
      noteCounts.set(id, (noteCounts.get(id) ?? 0) + 1);
    }

    const openTaskCounts = new Map<string, number>();
    for (const task of tasksResult.data ?? []) {
      if (task.completed_at) continue;
      const id = task.contact_id as string;
      openTaskCounts.set(id, (openTaskCounts.get(id) ?? 0) + 1);
    }

    const contacts = (contactsResult.data ?? []).map((c) => ({
      id: c.id,
      display_name: c.display_name,
      outreach_status: c.outreach_status,
      contact_channel: c.contact_channel,
      contact_handle: c.contact_handle,
      activation_blocker: c.activation_blocker,
      last_contact_at: c.last_contact_at,
      created_at: c.created_at,
      note_count: noteCounts.get(c.id) ?? 0,
      open_task_count: openTaskCounts.get(c.id) ?? 0,
    }));

    return NextResponse.json({ contacts });
  } catch (error) {
    return serverError("Unlinked contacts route error:", error);
  }
}
