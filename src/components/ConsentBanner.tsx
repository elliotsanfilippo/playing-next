"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/src/components/ui/Button";
import { updateConsent } from "@/src/lib/consent";

const STORAGE_KEY = "pn-cookie-consent";

type StoredConsent = "granted" | "denied";

function readStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

/*
 * Analytics is the only category that matters right now (no ad
 * pixels/remarketing in use), so this is a single accept/reject
 * choice rather than a per-category picker. Consent Mode always
 * resets to denied on a fresh page load (the inline script in
 * app/layout.tsx runs before this ever mounts) — this restores a
 * returning visitor's earlier choice on mount, so they're not asked
 * again every visit.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState<"accept" | "reject" | null>(null);

  useEffect(() => {
    const stored = readStoredConsent();

    if (!stored) {
      setVisible(true);
      return;
    }

    updateConsent({ analytics: stored === "granted", ads: false });
  }, []);

  const choose = (choice: StoredConsent) => {
    if (pending) return;

    setPending(choice === "granted" ? "accept" : "reject");
    window.localStorage.setItem(STORAGE_KEY, choice);
    updateConsent({ analytics: choice === "granted", ads: false });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-zinc-950/95 p-4 backdrop-blur-xl sm:p-5">
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-zinc-400">
          We use cookies to understand how people use Playing Next and
          improve the product. See our{" "}
          <Link
            href="/legal/privacy"
            className="text-white underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            Privacy Policy
          </Link>{" "}
          for details.
        </p>

        <div className="flex w-full shrink-0 gap-3 sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => choose("denied")}
            disabled={pending !== null}
          >
            {pending === "reject" ? "Saving..." : "Reject"}
          </Button>

          <Button
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => choose("granted")}
            disabled={pending !== null}
          >
            {pending === "accept" ? "Saving..." : "Accept"}
          </Button>
        </div>
      </div>
    </div>
  );
}
