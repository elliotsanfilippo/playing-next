declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export type ConsentCategory = "analytics" | "ads";

/*
 * Bridge between whatever consent banner ends up on the site and
 * Google Consent Mode. app/layout.tsx reads any stored choice
 * synchronously before GTM loads, so a returning "granted" visitor is
 * tracked correctly from their very first pageview — this only needs
 * to announce a change during the current session (a fresh
 * Accept/Reject click, or Manage Preferences). Call from the banner's
 * handlers — nothing else needs to change on the GTM/GA4 side.
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
}
