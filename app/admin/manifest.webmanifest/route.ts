/*
 * ── The Admin install, kept away from the DJ one ───────────────────
 *
 * Served as its own document at /admin/manifest.webmanifest so that
 * app/manifest.ts - the DJ install, whose start_url is /dj/dashboard -
 * is not touched at all. Two manifests, two Home Screen apps, no shared
 * state between them.
 *
 * scope is /admin, so links out of the Admin (the public site, an
 * external URL) open in the browser rather than inside the app, while
 * /admin and /admin/login stay in it.
 *
 * A Route Handler rather than a second manifest.ts because Next's file
 * convention for manifests only applies at the app root.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: "Playing Next Admin",
      short_name: "PN Admin",
      description: "Private operational CRM for Playing Next.",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      orientation: "portrait",
      background_color: "#070809",
      theme_color: "#070809",
      icons: [
        {
          src: "/icons/admin-icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/admin-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        /*
         * Deliberately no "maskable" entry. A maskable icon is expected
         * to carry its artwork inside a safe zone and let the platform
         * crop the rest; this mark is centred on a plain white field, so
         * declaring it maskable would invite Android to zoom in and clip
         * the triangle. "any" lets each platform letterbox it instead.
         */
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
