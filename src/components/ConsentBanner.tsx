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
 * Analytics is the only optional category right now (no ad pixels/
 * remarketing in use) — the preferences panel only has the one real
 * toggle, with Essential shown alongside it as always-on for
 * transparency rather than because it's actually a choice. Consent
 * Mode always resets to denied on a fresh page load (the inline
 * script in app/layout.tsx runs before this ever mounts) — this
 * restores a returning visitor's earlier choice on mount, so they're
 * not asked again every visit.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(false);
  const [pending, setPending] = useState<"accept" | "reject" | "save" | null>(
    null
  );

  useEffect(() => {
    const stored = readStoredConsent();

    if (!stored) {
      setVisible(true);
      return;
    }

    updateConsent({ analytics: stored === "granted", ads: false });
  }, []);

  const save = (choice: StoredConsent, label: "accept" | "reject" | "save") => {
    if (pending) return;

    setPending(label);
    window.localStorage.setItem(STORAGE_KEY, choice);
    updateConsent({ analytics: choice === "granted", ads: false });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-zinc-950/95 p-4 backdrop-blur-xl sm:p-5">
      <div className="mx-auto max-w-4xl">
        {showPreferences ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-6 text-zinc-400">
              Choose which cookies you&apos;re comfortable with. See our{" "}
              <Link
                href="/legal/privacy"
                className="text-white underline decoration-dotted underline-offset-2 hover:text-accent"
              >
                Privacy Policy
              </Link>{" "}
              for details.
            </p>

            <div className="flex flex-col gap-3 rounded-control border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Essential
                  </p>
                  <p className="text-xs text-zinc-500">
                    Required for the site to work. Always on.
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-zinc-500">
                  Always active
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Analytics
                  </p>
                  <p className="text-xs text-zinc-500">
                    Helps us understand how people use Playing Next.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analyticsChoice}
                  aria-label="Toggle analytics cookies"
                  onClick={() => setAnalyticsChoice((value) => !value)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    analyticsChoice ? "bg-accent" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                      analyticsChoice ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => setShowPreferences(false)}
                disabled={pending !== null}
              >
                Back
              </Button>

              <Button
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() =>
                  save(analyticsChoice ? "granted" : "denied", "save")
                }
                disabled={pending !== null}
              >
                {pending === "save" ? "Saving..." : "Save preferences"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
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

            <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
              <Button
                variant="ghost"
                size="sm"
                className="w-full whitespace-nowrap sm:w-auto"
                onClick={() => setShowPreferences(true)}
                disabled={pending !== null}
              >
                Manage preferences
              </Button>

              <div className="flex w-full gap-3 sm:w-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 whitespace-nowrap sm:flex-none"
                  onClick={() => save("denied", "reject")}
                  disabled={pending !== null}
                >
                  {pending === "reject" ? "Saving..." : "Reject All"}
                </Button>

                <Button
                  size="sm"
                  className="flex-1 whitespace-nowrap sm:flex-none"
                  onClick={() => save("granted", "accept")}
                  disabled={pending !== null}
                >
                  {pending === "accept" ? "Saving..." : "Accept All"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
