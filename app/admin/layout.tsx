import type { Metadata, Viewport } from "next";

/*
 * ── The Admin's own Home Screen identity ──────────────────────────
 *
 * Everything here is scoped to /admin and /admin/login. The root layout
 * and app/manifest.ts are deliberately untouched, because that manifest
 * is the DJ install: its start_url is /dj/dashboard, and a DJ who adds
 * Playing Next to their Home Screen must keep getting exactly that.
 * Nested metadata in Next overrides the root for this segment only.
 *
 * iOS caveat worth knowing before debugging this: a Home Screen web app
 * has its own storage container, separate from Safari. Signing in inside
 * Safari and then adding to the Home Screen produces an app that starts
 * logged out. The sign-in has to happen inside the installed app once.
 */
export const metadata: Metadata = {
  title: "PN Admin",
  /* Scoped manifest. start_url and scope are both /admin, so the app
     opens on the CRM rather than the public homepage. */
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    /* iOS truncates Home Screen labels around 11-12 characters, so
       "Playing Next Admin" would render as "Playing Ne...". The full
       name lives in the manifest; this is the label under the icon. */
    title: "PN Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    /* White tile with the green play mark, against the DJ app's dark
       tile. The inversion is the whole differentiator on a Home Screen. */
    apple: "/icons/admin-icon-180.png",
    icon: [
      { url: "/icons/admin-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  /* The Admin must not become discoverable. This is belt and braces
     next to the 404-rather-than-denial shell, not a substitute for it. */
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export const viewport: Viewport = {
  themeColor: "#070809",
  /*
   * Required, and absent from the root layout. Without viewport-fit
   * cover, env(safe-area-inset-*) resolves to 0 on iOS - and combined
   * with statusBarStyle "black-translucent", which deliberately puts
   * content underneath the status bar, the Admin's sticky header would
   * sit behind the clock and the bottom nav behind the home indicator.
   *
   * Scoped here rather than added to the root on purpose: switching it
   * on globally would activate the DJ dashboard's existing safe-area
   * rules, which have never actually applied, and that is a change to
   * the DJ experience that does not belong in this piece of work.
   */
  viewportFit: "cover",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
