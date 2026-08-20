"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Gift } from "lucide-react";
import { supabase } from "../../src/lib/supabase";
import {
  PRO_MONTHLY_PRICE_GBP,
  PRO_BREAK_EVEN_REQUESTS,
  TYPICAL_REQUEST_PRICE_GBP,
} from "@/src/lib/pricing";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";

const FREE_FEATURES = [
  "Unlimited song requests",
  "Live dashboard & guest queue",
  "QR code request page",
  "Guest push notifications",
];

const PRO_FEATURES = [
  "Everything in Free",
  "0% platform fee: keep 100% of every request",
  "Full analytics: acceptance rate and top requested songs",
  "Events Mode: named events with their own pricing and earnings summary",
  "Scheduled auto-close: set requests to close themselves at the end of a night",
];

export default function PlansPage() {
  const router = useRouter();

  /*
   * null while the session check is still in flight. The back link
   * previously started as "not logged in", so a DJ who clicked it in
   * the first moments on the page was sent to the marketing homepage
   * instead of their dashboard. Rendering the link disabled-looking
   * until the answer is known keeps its position and size stable while
   * making it impossible to click through to the wrong destination.
   */
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [qrBoxAvailable, setQrBoxAvailable] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(Boolean(session));
    });

    fetch("/api/qr-box/availability")
      .then((res) => res.json())
      .then((data) => setQrBoxAvailable(data.available === true))
      .catch(() => setQrBoxAvailable(false));
  }, []);

  const upgradeToPro = async () => {
    if (subscribing) return;

    setSubscribing(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/signup");
        return;
      }

      const response = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to start the Pro upgrade.");
      }

      window.location.href = result.url;
    } catch (error) {
      console.log("Plans upgrade error:", error);
      setSubscribing(false);
    }
  };

  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-white sm:px-6 sm:py-14">
      <div className="mx-auto max-w-4xl">
        {loggedIn === null ? (
          <span
            aria-hidden
            className="text-sm font-semibold text-zinc-600"
          >
            ← Back
          </span>
        ) : (
          <Link
            href={loggedIn ? "/dj/dashboard" : "/"}
            className="text-sm font-semibold text-zinc-400 transition hover:text-white"
          >
            ← {loggedIn ? "Back to Dashboard" : "Back to Playing Next"}
          </Link>
        )}

        <div className="mt-8 text-center">
          <Eyebrow tone="accent" className="justify-center">
            Pricing
          </Eyebrow>

          <h1 className="mt-3 text-display">Simple, honest pricing</h1>

          <p className="mx-auto mt-4 max-w-lg text-zinc-400">
            No hidden fees. Pick the plan that fits how often you take
            requests.
          </p>
        </div>

        {qrBoxAvailable && (
          <div className="mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-control border border-accent/20 bg-accent/10 px-5 py-4 text-sm">
            <Gift size={18} className="shrink-0 text-accent" />
            <p className="text-zinc-200">
              <strong className="text-accent">
                First 50 DJs to go Pro
              </strong>{" "}
              get a free physical QR display block for their booth, you
              just cover shipping.
            </p>
          </div>
        )}

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <Card variant="elevated" className="flex flex-col p-6 sm:p-8">
            <Eyebrow>Free</Eyebrow>
            <p className="mt-3 text-4xl font-bold">
              £0
              <span className="text-base font-medium text-zinc-500">
                /month
              </span>
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              15% platform fee per accepted request
            </p>

            <ul className="mt-6 flex-1 space-y-3">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <Check size={16} className="mt-0.5 shrink-0 text-zinc-500" />
                  {feature}
                </li>
              ))}
            </ul>

            {loggedIn === false && (
              <Link
                href="/signup"
                className="mt-7 inline-flex h-12 items-center justify-center rounded-control border border-white/10 bg-white/5 px-6 font-semibold text-white transition hover:bg-white/10"
              >
                Start free
              </Link>
            )}
          </Card>

          <Card
            variant="elevated"
            className="flex flex-col border-accent/30 bg-accent/[0.04] p-6 shadow-xl shadow-accent/5 sm:p-8"
          >
            <Eyebrow tone="accent">Pro</Eyebrow>
            <p className="mt-3 text-4xl font-bold">
              £{PRO_MONTHLY_PRICE_GBP.toFixed(2)}
              <span className="text-base font-medium text-zinc-500">
                /month
              </span>
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              0% platform fee: keep everything you earn
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Pays for itself once you&rsquo;re taking around{" "}
              {PRO_BREAK_EVEN_REQUESTS} requests a month at a typical £
              {TYPICAL_REQUEST_PRICE_GBP} price
            </p>

            <ul className="mt-6 flex-1 space-y-3">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-200">
                  <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              onClick={upgradeToPro}
              disabled={subscribing}
              className="mt-7"
            >
              {subscribing
                ? "Opening..."
                : loggedIn
                  ? "Upgrade to Pro"
                  : "Start free, upgrade anytime"}
            </Button>
          </Card>
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-zinc-500">
          Every plan starts free. There&rsquo;s no card needed to sign up.
          Upgrade or cancel Pro any time from your account settings.
        </p>
      </div>
    </main>
  );
}
