"use client";

import { supabase } from "@/src/lib/supabase";

/*
 * Every admin request carries the caller's own access token, which
 * /api/admin/* checks against the ADMIN_EMAILS allowlist in
 * getAdminUser. The service-role key never leaves the server, so this is
 * the only credential the browser ever holds - and CRM tables refuse
 * that credential directly at the database anyway, verified in
 * production on 2026-08-29.
 *
 * Throws when there is no session, so a caller cannot mistake "signed
 * out" for "no data".
 */
export async function adminFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("NO_SESSION");

  return fetch(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

/** Parses a JSON response, turning a non-2xx into a thrown message. */
export async function adminJson<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The server sent something unreadable.");
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : "Something went wrong.";
    throw new Error(message);
  }

  return payload as T;
}
