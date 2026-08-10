"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";
import Button from "@/src/components/ui/Button";

const DISMISSED_KEY = "pn-a2hs-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function AddToHomeScreen() {
  const [dismissed, setDismissed] = useState(true);
  const [ios, setIos] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (window.localStorage.getItem(DISMISSED_KEY) === "true") return;

    setDismissed(false);
    setIos(isIOS());

    /*
     * Only Chromium-based browsers fire this — Safari (including iOS)
     * never does, since it has no equivalent API. Those get manual
     * Share-sheet instructions instead.
     */
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!installPrompt || installing) return;

    setInstalling(true);

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        dismiss();
      }
    } finally {
      setInstallPrompt(null);
      setInstalling(false);
    }
  };

  if (dismissed) return null;

  return (
    <div className="relative mb-6 rounded-card border border-accent/15 bg-accent/5 p-5 sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-4 top-4 text-zinc-500 transition hover:text-zinc-300"
      >
        <X size={18} />
      </button>

      <div className="flex items-start gap-4 pr-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Smartphone size={20} />
        </div>

        <div className="flex-1">
          <h2 className="font-semibold">Add Playing Next to your home screen</h2>

          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            Get to your dashboard in one tap during a gig — no browser tabs,
            no typing in the address bar.
          </p>

          {installPrompt ? (
            <Button
              size="sm"
              className="mt-4"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? "Adding..." : "Add to Home Screen"}
            </Button>
          ) : ios ? (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-zinc-400">
              Tap
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5">
                <Share size={13} /> Share
              </span>
              then <strong className="text-zinc-200">Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">
              Open your browser menu and look for{" "}
              <strong className="text-zinc-200">Add to Home Screen</strong> or{" "}
              <strong className="text-zinc-200">Install app</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
