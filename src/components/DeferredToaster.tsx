"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

/*
 * Sonner's Toaster costs about 11KB on every route in the app, including
 * static ones. /legal/privacy was shipping it to render legal text that
 * can never raise a toast.
 *
 * Nothing is lost by mounting it a moment later. Every toast in the app
 * is raised by a user action — a tip returning, a link being copied, a
 * request failing — and none of those can happen before the page is
 * interactive, which is well after this has mounted.
 */
const Toaster = dynamic(() => import("sonner").then((m) => m.Toaster), {
  ssr: false,
});

export default function DeferredToaster() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    /*
     * requestIdleCallback so the toast layer loads in whatever gap the
     * browser has spare rather than competing with hydration on a slow
     * phone. The timeout is the backstop for Safari, which still has no
     * requestIdleCallback, and for a device that never goes idle.
     */
    const idle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (typeof idle === "function") {
      idle(() => setReady(true), { timeout: 2000 });
      return;
    }

    const timer = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return null;

  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      duration={3000}
      theme="dark"
    />
  );
}
