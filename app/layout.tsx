import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import ConsentBanner from "@/src/components/ConsentBanner";
import DeferredToaster from "@/src/components/DeferredToaster";
import "./globals.css";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  metadataBase: new URL("https://playingnextapp.com"),
  title: "Playing Next",
  description: "DJ song request platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Playing Next",
  },
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Playing Next",
    description: "Song requests, straight to the DJ.",
    url: "https://playingnextapp.com",
    siteName: "Playing Next",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playing Next",
    description: "Song requests, straight to the DJ.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#070809",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {GTM_ID && (
          <>
            {/*
              Consent Mode defaults must run before GTM's own script
              evaluates, so every Google tag it loads starts with the
              right state from the very first hit — GTM's "Google Tag"
              tag type only sends its automatic pageview once, when it
              initialises, and won't resend it later just because
              consent changes mid-session (unlike the shared consent
              state itself, which any tag reads live). So a returning
              visitor's stored choice has to be read synchronously
              right here, before GTM loads — ConsentBanner's own
              updateConsent() call (src/lib/consent.ts) only needs to
              cover the current session's Accept/Reject after this.
              The storage key must stay in sync with STORAGE_KEY in
              src/components/ConsentBanner.tsx. beforeInteractive
              guarantees Next.js injects this ahead of GTM regardless
              of DOM order below.
            */}
            <Script id="consent-mode-default" strategy="beforeInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                var storedConsent;
                try {
                  storedConsent = localStorage.getItem('pn-cookie-consent');
                } catch (e) {
                  storedConsent = null;
                }
                gtag('consent', 'default', {
                  ad_storage: 'denied',
                  ad_user_data: 'denied',
                  ad_personalization: 'denied',
                  analytics_storage: storedConsent === 'granted' ? 'granted' : 'denied',
                  wait_for_update: 500
                });
              `}
            </Script>

            {/*
              afterInteractive, not beforeInteractive. The container
              still loads on every page and the tags inside it are
              untouched — but it no longer competes with hydration for
              the main thread before the page is usable. Measured on
              Production: beforeInteractive cost the homepage 468ms of
              FCP and 613ms of DOMContentLoaded, and on a throttled
              mobile connection roughly 8s of total load time, because
              gtm.js pulls gtag.js and the Clarity tag in behind it.

              The consent ordering contract above still holds, and holds
              more strongly than before: Next.js runs every
              beforeInteractive script ahead of every afterInteractive
              one, so consent defaults are now guaranteed to execute
              first by strategy rather than by injection order.
            */}
            <Script id="gtm-script" strategy="afterInteractive">
              {`
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${GTM_ID}');
              `}
            </Script>

            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
                height="0"
                width="0"
                style={{ display: "none", visibility: "hidden" }}
              />
            </noscript>
          </>
        )}

        {children}

        <ConsentBanner />

        <DeferredToaster />
      </body>
    </html>
  );
}
