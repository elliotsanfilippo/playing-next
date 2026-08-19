import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.211"],
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
