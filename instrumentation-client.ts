import * as Sentry from "@sentry/nextjs";

/*
 * No-op until NEXT_PUBLIC_SENTRY_DSN is set — Sentry.init() with an empty
 * DSN simply doesn't send anything, so this is safe to ship before a
 * Sentry project exists.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.2,
  enableLogs: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
