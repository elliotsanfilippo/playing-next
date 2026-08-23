"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isProEntitled } from "@/src/lib/planEntitlement";
import { Check, Gift } from "lucide-react";
import { supabase } from "../../src/lib/supabase";
import {
  FREE_PLATFORM_FEE_BPS,
  PRO_BREAK_EVEN_REQUESTS,
  PRO_MONTHLY_PRICE_GBP,
  PRO_PLATFORM_FEE_BPS,
  TYPICAL_REQUEST_PRICE_GBP,
} from "@/src/lib/pricing";
import Button from "@/src/components/ui/Button";

/*
 * Only what differs. The old page listed four Free features beside five
 * Pro ones, three of which restated the same 0% fee ("0% platform fee:
 * keep everything you earn" as the subheading, "0% platform fee: keep
 * 100% of every request" as a bullet, and the fee again in the Free
 * card for contrast). A DJ deciding whether to pay needs the difference,
 * once.
 */
const PRO_ADDS = [
  { name: "Analytics", what: "what your guests ask for, and how often you say yes" },
  { name: "Events Mode", what: "name a gig and give it its own prices" },
  { name: "Auto-close", what: "set requests to stop themselves at the end of the night" },
];

/* Said in one line rather than as a column of ticks whose job is to look
   shorter than the one next to it. Every item verified against a real
   gate: none of these is Pro-only. */
const SHARED = [
  "unlimited requests",
  "the live dashboard and queue",
  "your QR request page",
  "push alerts for new requests",
  "earnings and payouts",
];

const FREE_FEE = FREE_PLATFORM_FEE_BPS / 100;
const PRO_FEE = PRO_PLATFORM_FEE_BPS / 100;

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

  /*
   * One question answered in order: what am I on, what does Pro add,
   * what does it cost, what do I press.
   *
   * This replaced two equal marketing cards. They read as a generic
   * SaaS pricing page, and worse, they buried the decision: at 320px
   * the page ran 1771px and £49.99 sat at y=1033, so a DJ opening it on
   * a phone scrolled past the whole Free card before learning what Pro
   * costs. Free is now stated rather than sold against, and the only
   * list on the page is the part that actually differs.
   */
  return (
    <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
      <section className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Plans</h1>

          {loggedIn === null ? (
            <span aria-hidden className="h-11" />
          ) : (
            <Link
              href={loggedIn ? "/dj/dashboard" : "/"}
              className="inline-flex min-h-11 shrink-0 items-center rounded-control border border-white/10 bg-white/5 px-4 text-[13px] font-semibold text-white transition hover:bg-white/10"
            >
              {loggedIn ? "Dashboard" : "Playing Next"}
            </Link>
          )}
        </div>

        {/* ── What you're on ───────────────────────────────────────── */}
        <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Your plan
          </p>

          <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5 text-lg font-bold">
            {/* Unknown stays unknown. entitled is null until the profile
                answers, and a logged-out visitor has no plan at all. */}
            {entitled === null
              ? loggedIn === false
                ? "Free"
                : "Checking..."
              : entitled
                ? "Pro"
                : "Free"}

            {entitled !== null && (
              <span className="text-[13px] font-medium text-zinc-400">
                {entitled
                  ? `£${PRO_MONTHLY_PRICE_GBP.toFixed(2)} a month`
                  : "No monthly cost"}
              </span>
            )}
          </p>

          <p className="mt-1.5 text-[13px] leading-5 text-zinc-300">
            {entitled
              ? `${PRO_FEE}% platform fee on accepted requests. You keep your full price.`
              : `${FREE_FEE}% platform fee on accepted requests.`}
          </p>
        </div>

        {/* ── The upgrade, or the billing link ─────────────────────── */}
        <div className="mt-4 overflow-hidden rounded-card border border-accent/25 bg-accent/[0.05]">
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-sm font-bold tracking-tight text-accent">
                {entitled ? "You're on Pro" : "Pro"}
              </h2>

              {/* The price, up top, where it is read in the first second
                  rather than a screen and a half down. */}
              <p className="text-2xl font-bold tabular-nums">
                £{PRO_MONTHLY_PRICE_GBP.toFixed(2)}
                <span className="ml-1 text-[13px] font-medium text-zinc-400">
                  a month
                </span>
              </p>
            </div>

            <p className="mt-1.5 text-[13px] leading-5 text-zinc-300">
              {PRO_FEE}% platform fee, and three things Free doesn&rsquo;t have.
            </p>

            {/* The only list on the page: what actually changes. */}
            <ul className="mt-4 space-y-2.5">
              {PRO_ADDS.map((item) => (
                <li key={item.name} className="flex items-start gap-2.5">
                  <Check
                    size={15}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-accent"
                  />
                  <span className="text-[13px] leading-5 text-zinc-200">
                    <span className="font-semibold text-white">{item.name}</span>{" "}
                    {item.what}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              onClick={entitled ? openBilling : upgradeToPro}
              disabled={subscribing || entitled === null}
              className="mt-5 h-12 w-full sm:w-auto sm:px-6"
            >
              {subscribing
                ? "Opening..."
                : entitled
                  ? "Manage billing"
                  : loggedIn === false
                    ? "Start free, upgrade anytime"
                    : "Upgrade to Pro"}
            </Button>

            {/* Secondary, and honest about the assumption. Not the centre
                of the page, and no calculator. */}
            {!entitled && (
              <p className="mt-2.5 text-xs leading-5 text-zinc-400">
                At a typical £{TYPICAL_REQUEST_PRICE_GBP} request, Pro pays for
                itself at around {PRO_BREAK_EVEN_REQUESTS} requests a month.
                Your own break-even moves with your prices.
              </p>
            )}
          </div>

          {qrBoxAvailable && !entitled && (
            <p className="flex items-start gap-2.5 border-t border-accent/15 bg-accent/[0.04] px-4 py-3 text-xs leading-5 text-zinc-200 sm:px-6">
              <Gift size={14} aria-hidden className="mt-0.5 shrink-0 text-accent" />
              <span>
                <strong className="font-semibold text-accent">
                  First 50 DJs to go Pro
                </strong>{" "}
                get a free QR display block for their booth, you just cover
                shipping.
              </span>
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-control border border-status-declined/25 bg-status-declined/10 p-3.5 text-[13px] leading-5 text-status-declined"
          >
            {error}
          </p>
        )}

        {/*
          Free stated, not sold against. It runs a night perfectly well
          and saying so is more honest than a column of ticks whose only
          job is to look shorter than the one beside it.
        */}
        <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
          <h2 className="text-sm font-bold tracking-tight">
            Both plans include
          </h2>

          <p className="mt-1.5 text-[13px] leading-5 text-zinc-300">
            {SHARED.join(", ")}.
          </p>

          <p className="mt-2.5 text-xs leading-5 text-zinc-400">
            No card needed to sign up. Cancel Pro any time from billing.
          </p>
        </div>
      </section>
    </main>
  );
}
