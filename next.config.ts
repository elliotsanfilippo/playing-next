import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/*
 * Supabase Storage is the only remote image host we serve from. Deriving
 * the hostname from the public URL rather than hard-coding the project
 * ref keeps Preview and Production pointing at whichever project their
 * own environment is configured for.
 */
const supabaseImageHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.211"],
  /*
   * DJs upload whatever their phone produced — ELSAN's profile photo was
   * 1023x1023 and 338KB being downloaded to fill a 56px avatar, which is
   * 30% of the guest request page's transfer for something the size of a
   * thumbnail. Routing these through the image optimizer resizes and
   * re-encodes per request, so the guest gets ~10KB instead, and a future
   * DJ uploading a 4MB photo costs the guest nothing extra.
   *
   * This is deliberately a platform-level fix rather than compressing the
   * images already in the bucket: Storage permissions and the upload path
   * in DJ settings are untouched, and the original upload stays intact as
   * the source of truth.
   */
  images: supabaseImageHost
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: supabaseImageHost,
            pathname: "/storage/v1/object/public/**",
          },
        ],
      }
    : undefined,
  async redirects() {
    return [
      /*
       * The dj-elliot test account's slug was renamed to
       * dj-elliot-test (2026-08-19) to make clear in the admin
       * dashboard that it isn't a real DJ — this keeps any
       * already-printed/saved QR codes or links working.
       */
      {
        source: "/request/dj-elliot/:path*",
        destination: "/request/dj-elliot-test/:path*",
        permanent: false,
      },
    ];
  },
};

/*
 * org/project/authToken are only needed for uploading source maps on
 * build — without SENTRY_AUTH_TOKEN set, the plugin skips that step
 * (with a warning) rather than failing the build, so this is safe to
 * ship before a Sentry project exists.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
