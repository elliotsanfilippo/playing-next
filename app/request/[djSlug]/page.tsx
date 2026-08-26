import RequestPageClient from "./RequestPageClient";

/*
 * ── Why this file is a server component that renders nothing ──────
 *
 * The guest request screen is entirely client-rendered: it reads its
 * slug with useParams(), fetches the DJ with the public anon Supabase
 * query, and reads the ?tipped= return from window.location.search.
 * The server therefore contributes no DJ data to the HTML at all — the
 * shell it produces is the same app skeleton for every DJ.
 *
 * Despite that, the route was being rendered on demand for every single
 * scan (x-vercel-cache: MISS, private/no-store) because a dynamic
 * segment with no generateStaticParams is dynamic by default. Guests
 * were paying a full serverless invocation, and sometimes a cold start,
 * to receive a shell that never varies.
 *
 * Route segment config has to live on a server component; exporting it
 * from the "use client" page was silently ignored (the build still
 * marked the route dynamic). So the client screen moved to
 * RequestPageClient.tsx unchanged, and this shell carries the config.
 *
 * Nothing about the data boundary moves with it. The DJ profile is
 * still fetched in the browser under the anon role against the same
 * 12-column public allowlist, so a cached shell cannot leak anything a
 * guest could not already read, and a DJ changing their name, photo or
 * pricing takes effect on the next guest fetch without a rebuild.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  /*
   * Intentionally empty. There is no build-time list of DJs to
   * prerender and there should not be — a DJ who signs up after a
   * deploy must work immediately. Returning nothing, with
   * dynamicParams left at its default of true, means every slug is
   * generated on first request and then served from the CDN.
   */
  return [];
}

export default function RequestPage() {
  return <RequestPageClient />;
}
