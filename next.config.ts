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


/*
 * ── HTTP security policy ──────────────────────────────────────────
 *
 * Added 2026-09-05, closing finding F2 of the release-candidate
 * security review. Before this, Production returned exactly two
 * headers: HSTS and x-powered-by.
 *
 * Every origin below was taken from a real page load rather than from
 * a list of things we thought we used. On the guest request page the
 * browser actually contacts:
 *
 *   bxryfvyzbxnmwicqdmag.supabase.co   data + realtime + profile images
 *   www.googletagmanager.com           GTM, which then injects GA4
 *   region1.google-analytics.com       GA4 ingest
 *   scripts.clarity.ms, www.clarity.ms, f.clarity.ms
 *   o4511870891261952.ingest.de.sentry.io   note: DE region
 *
 * Two that do NOT appear in that list but must be allowed anyway:
 *
 *   i.scdn.co   Spotify album art, rendered as a plain <img> and so
 *               only requested once a guest searches. Miss it and the
 *               core request flow loses every thumbnail.
 *   wss://      Supabase Realtime. Both the DJ dashboard and the guest
 *               request page open a channel. Miss it and the live
 *               queue silently stops updating, which is exactly the
 *               kind of break a careless CSP causes.
 *
 * Things deliberately NOT in the policy:
 *
 *   Stripe      There is no @stripe/stripe-js dependency and no
 *               embedded Stripe iframe. Checkout, Connect onboarding
 *               and the billing portal are all full redirects, so
 *               Stripe needs no script-src or frame-src entry.
 *   COEP        require-corp would break GTM, Clarity and Supabase
 *               images for no benefit this product can use.
 *   preload     HSTS gains includeSubDomains but NOT preload. Preload
 *               is close to irreversible and is Elliot's call, not a
 *               side effect of a security pass.
 *
 * script-src carries 'unsafe-inline' because Next.js App Router emits
 * inline hydration and streaming scripts on every page, and a nonce
 * would require middleware on every request. The allow-list still does
 * real work: an injected <script src="https://evil.example/x.js"> is
 * blocked even though inline script is permitted.
 */
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

const SUPABASE_WS = SUPABASE_ORIGIN.replace(/^https:/, "wss:");

const ANALYTICS_SCRIPTS = [
  "https://www.googletagmanager.com",
  "https://*.clarity.ms",
];

const ANALYTICS_CONNECT = [
  "https://www.googletagmanager.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://*.clarity.ms",
];

const SENTRY_CONNECT = "https://*.ingest.de.sentry.io";

/** The policy public pages get: analytics allowed, everything else shut. */
const csp = (withAnalytics: boolean) =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${withAnalytics ? " " + ANALYTICS_SCRIPTS.join(" ") : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${SUPABASE_ORIGIN} https://i.scdn.co${
      withAnalytics ? " https://www.googletagmanager.com https://*.google-analytics.com https://*.clarity.ms" : ""
    }`,
    "font-src 'self' data:",
    `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS} ${SENTRY_CONNECT}${
      withAnalytics ? " " + ANALYTICS_CONNECT.join(" ") : ""
    }`,
    "worker-src 'self'",
    "manifest-src 'self'",
    `frame-src ${withAnalytics ? "https://www.googletagmanager.com" : "'none'"}`,
    "upgrade-insecure-requests",
  ].join("; ");

const BASE_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  /* Stops Next.js announcing itself in every response. */
  poweredByHeader: false,
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
  /*
    The Admin gets a policy with no analytics origins at all. GTM is
    still rendered by the root layout, but with googletagmanager.com
    absent from script-src the browser refuses to load it, so the
    container cannot execute on the highest-value session in the
    product. That is the same outcome as ripping GTM out of the layout,
    without touching the consent-mode ordering contract documented in
    app/layout.tsx - which is load-bearing, measured, and not something
    to improvise during a security pass.

    /dj/* deliberately keeps the standard policy. Its analytics carry
    the signup-to-onboarding funnel that growth instrumentation is
    supposed to measure later; switching it off here would quietly undo
    planned work. One line to change if that call goes the other way.
  */
  async headers() {
    /*
      Order matters and cost a bug on the way in. Both sources match
      /admin, and the LAST matching rule wins for a repeated header
      key - so with the specific rule first, the general one silently
      overwrote it and the Admin was served the analytics policy.
      Verified against a production build rather than assumed.
    */
    return [
      {
        source: "/:path*",
        headers: [
          ...BASE_SECURITY_HEADERS,
          { key: "Content-Security-Policy", value: csp(true) },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          ...BASE_SECURITY_HEADERS,
          { key: "Content-Security-Policy", value: csp(false) },
        ],
      },
    ];
  },
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
