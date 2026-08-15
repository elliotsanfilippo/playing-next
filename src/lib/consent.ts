declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export type ConsentCategory = "analytics" | "ads";

// Tracks whether we've already recovered the lost initial pageview in
// this page load, so a granted->granted call (e.g. re-saving the same
// preference) doesn't send a duplicate page_view.
let hasFiredConsentedPageview = false;

/*
 * Bridge between whatever consent banner ends up on the site and
 * Google Consent Mode. app/layout.tsx sets every category to "denied"
 * by default before GTM loads, so no tag fires until this is called
 * with a real grant. Call from the banner's "Accept"/"Reject" handlers
 * once it exists — nothing else needs to change on the GTM/GA4 side.
 *
 * The "denied" default in app/layout.tsx is a static inline script —
 * it can't read localStorage before it runs, so it's always "denied"
 * on first paint, even for a returning visitor who granted consent
 * last time. GA4's automatic Enhanced Measurement page_view fires
 * immediately once GTM loads, using whatever consent state is active
 * at that instant — which is always "denied", since ConsentBanner's
 * restore-from-storage effect (and any fresh Accept click) only runs
 * after hydration. A hit sent while analytics_storage is denied is
 * used only for consent-mode modeling and never appears in GA4
 * reports or Realtime. So the first time analytics consent becomes
 * granted in a page load — whether from an Accept click or from
 * restoring a stored "granted" choice on mount — we manually re-fire
 * page_view so a real, trackable hit actually gets sent.
 */
export function updateConsent(granted: Record<ConsentCategory, boolean>) {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push([
    "consent",
    "update",
    {
      analytics_storage: granted.analytics ? "granted" : "denied",
      ad_storage: granted.ads ? "granted" : "denied",
      ad_user_data: granted.ads ? "granted" : "denied",
      ad_personalization: granted.ads ? "granted" : "denied",
    },
  ]);

  if (granted.analytics && !hasFiredConsentedPageview) {
    hasFiredConsentedPageview = true;
    window.dataLayer.push([
      "event",
      "page_view",
      {
        page_location: window.location.href,
        page_title: document.title,
      },
    ]);
  }
}
