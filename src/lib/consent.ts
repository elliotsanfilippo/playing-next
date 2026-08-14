declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export type ConsentCategory = "analytics" | "ads";

/*
 * Bridge between whatever consent banner ends up on the site and
 * Google Consent Mode. app/layout.tsx sets every category to "denied"
 * by default before GTM loads, so no tag fires until this is called
 * with a real grant. Call from the banner's "Accept"/"Reject" handlers
 * once it exists — nothing else needs to change on the GTM/GA4 side.
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
