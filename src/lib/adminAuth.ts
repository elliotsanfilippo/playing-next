import { SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

/*
 * A small, easy-to-edit allowlist rather than a database role — there's
 * exactly one admin (Elliot) today, so a schema change (an is_admin
 * column/table) would be pure overhead. Extend this array directly when
 * more admins are needed.
 */
export const ADMIN_EMAILS = ["elliot@playingnextapp.com"];

export async function getAdminUser(
  supabaseAuth: SupabaseClient,
  request: NextRequest
): Promise<User | null> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(accessToken);

  if (error || !user?.email || !ADMIN_EMAILS.includes(user.email)) {
    return null;
  }

  return user;
}
