"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isProEntitled } from "@/src/lib/planEntitlement";
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
  /* Push goes to the DJ, not the guest: the only sender is
     sendPushToDJ. It used to read "Guest push notifications", which
     described a feature that does not exist. */
  "Push alerts when a request comes in",
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
  /*
   * The page never used to know what the DJ was already on, so a Pro DJ
   * was shown "Upgrade to Pro", and clicking it returned a 409 that the
   * catch below swallowed without a word. Undefined means we have not
   * been able to find out, which is deliberately not the same as Free.
   */
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setLoggedIn(Boolean(session));

      if (!session) return;

      const { data } = await supabase
        .from("dj_profiles")
        .select("plan, stripe_subscription_status")
        .eq("user_id", session.user.id)
        .maybeSingle();

      /* Left null on failure rather than assumed Free: showing an
         upgrade button to someone who already pays is the bug this
         replaced. */
      if (data) setEntitled(isProEntitled(data));
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
        /* Already subscribed in some form. Billing is where that gets
           managed, and sending them to a second checkout is how two
           subscriptions happen. */
        if (result.code === "subscription_exists") {
          setEntitled(true);
          await openBilling();
          return;
        }

        throw new Error(result.error || "Unable to start the Pro upgrade.");
      }

      window.location.assign(result.url);
    } catch (caughtError) {
      /* Said out loud. Every failure here used to be logged to the
         console and nothing else, so the button simply flickered. */
      console.log("Plans upgrade error:", caughtError);
      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "Unable to start the Pro upgrade."
      );
      setSubscribing(false);
    }
  };

  const openBilling = async () => {
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/stripe/billing-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to open billing.");
      }

      window.location.assign(result.url);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "Unable to open billing."
      );
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
            /* min-h-11: the link was 18px tall, which is a fine reading
               size and a poor thumb target. */
            className="inline-flex min-h-11 items-center text-sm font-semibold text-zinc-400 transition hover:text-white"
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
            {/* A real heading. Both plan names were Eyebrow paragraphs,
                so the page offered a screen reader one h1 and two
                unlabelled pricing cards. */}
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Free
            </h2>
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
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              Pro
            </h2>
            <p className="mt-3 text-4xl font-bold">
              £{PRO_MONTHLY_PRICE_GBP.toFixed(2)}
              <span className="text-base font-medium text-zinc-500">
                /month
              </span>
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              0% platform fee: keep everything you earn
            </p>
            {/* zinc-400, not zinc-500: this measured 3.85:1, so the one
                claim on the page that most deserves scrutiny was also
                the hardest to read. */}
            <p className="mt-1 text-xs text-zinc-400">
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

            {/* What the DJ is already on decides what this offers. A Pro
                DJ gets billing, not a second checkout. */}
            <Button
              onClick={entitled ? openBilling : upgradeToPro}
              disabled={subscribing}
              className="mt-7"
            >
              {subscribing
                ? "Opening..."
                : entitled
                  ? "Manage billing"
                  : loggedIn
                    ? "Upgrade to Pro"
                    : "Start free, upgrade anytime"}
            </Button>

            {entitled && (
              <p className="mt-2.5 text-center text-xs text-accent">
                You&rsquo;re on Pro.
              </p>
            )}
          </Card>
        </div>

        {error && (
          <p
            role="alert"
            className="mx-auto mt-6 max-w-xl rounded-control border border-status-declined/25 bg-status-declined/10 p-3.5 text-center text-sm text-status-declined"
          >
            {error}
          </p>
        )}

        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-zinc-400">
          Every plan starts free. There&rsquo;s no card needed to sign up.
          Upgrade or cancel Pro any time from your account settings.
        </p>
      </div>
    </main>
  );
}
