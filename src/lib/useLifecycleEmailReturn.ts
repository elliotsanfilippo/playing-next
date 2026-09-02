"use client";

import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

/*
 * ── Recording a return, once, from an authenticated page ─────────
 *
 * Reads the `from` marker the recovery email's CTA carries and, if it
 * names a lifecycle template, tells the server the DJ came back. The
 * server does the deciding; this only reports the arrival.
 *
 * Deliberately not a pixel and not a redirect: by the time this runs the
 * DJ is already on an authenticated Playing Next page, signed in as
 * themselves, which is both more accurate than an open and less
 * intrusive than one.
 *
 * The ref guard is for React's development double-invoke and for the
 * effect re-running on a re-render. The real protection against counting
 * twice is the server's `returned_at is null` and the database trigger
 * behind it; this just avoids pointless requests.
 *
 * Nothing here surfaces to the DJ. A failed attribution is a lost data
 * point, not a problem the person trying to finish their setup should
 * ever hear about.
 */

const TEMPLATES = new Set(["recovery_1", "recovery_2"]);

export function useLifecycleEmailReturn(from: string | null) {
  const reported = useRef(false);

  useEffect(() => {
    if (!from || !TEMPLATES.has(from) || reported.current) return;

    reported.current = true;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        await fetch("/api/dj/lifecycle-email/returned", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ template: from }),
        });
      } catch {
        /* Silence is correct here. See the note above. */
      }
    })();
  }, [from]);
}
