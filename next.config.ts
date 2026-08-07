import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.211"],
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
