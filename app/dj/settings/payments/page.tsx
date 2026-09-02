"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Building2, Check, Clock, ExternalLink } from "lucide-react";
import { supabase } from "../../../../src/lib/supabase";
import Button from "@/src/components/ui/Button";
import Skeleton from "@/src/components/ui/Skeleton";
import type {
  ConnectHealth,
  ConnectState,
  UnreachableReason,
} from "@/src/lib/connectHealth";
import { useLifecycleEmailReturn } from "@/src/lib/useLifecycleEmailReturn";

/*
 * Is my payout setup healthy, and where will my earnings go?
 *
 * Two questions, kept apart, because Stripe answers them separately:
 * whether Playing Next can send this DJ their earnings, and whether
 * Stripe will move that money on to their bank. The old page collapsed
 * both into "Stripe is connected" or "Complete Stripe onboarding", which
 * meant a paused payout read as a broken account.
 *
 * Balance, Withdraw and payout history are Earnings' job. This page
 * points at them and does not restate them.
 */

type StatusResponse =
  | { reachable: true; health: ConnectHealth }
  | { reachable: false; reason: UnreachableReason; hasStoredAccount: boolean };

const STATE_COPY: Record<
  ConnectState,
  { title: string; body: string; tone: "good" | "warn" | "bad" }
> = {
  ready: {
    title: "Ready",
    body: "You can receive Playing Next earnings, and payouts to your bank are active.",
    tone: "good",
  },
  payouts_paused: {
    title: "Payouts paused",
    body: "You can still receive Playing Next earnings, and they are safe in your Stripe balance. Stripe needs something before payouts to your bank continue.",
    tone: "warn",
  },
  setup_incomplete: {
    title: "Setup incomplete",
    body: "Your account cannot receive Playing Next earnings yet, so guests can't request from you. Finishing setup with Stripe takes a few minutes.",
    tone: "warn",
  },
  restricted: {
    title: "Account restricted",
    body: "Stripe has restricted your account, so Playing Next can't send you earnings right now. Stripe will explain what they need.",
    tone: "bad",
  },
  not_connected: {
    title: "Not connected",
    body: "Connect with Stripe so guests can pay you. Stripe collects your identity and bank details directly, and Playing Next never sees them.",
    tone: "bad",
  },
};

const UNREACHABLE_COPY: Record<UnreachableReason, string> = {
  temporary:
    "We couldn't reach Stripe just now. Your account and your earnings are unaffected.",
  wrong_environment:
    "The Stripe account saved against your profile can't be read by this environment. Nothing has been changed, and this needs us to look at it rather than you.",
  missing:
    "Stripe no longer recognises the account saved against your profile. Nothing has been changed. Please contact us so we can reattach or replace it safely.",
};

const toneClasses = {
  good: "border-accent/25 bg-accent/10",
  warn: "border-amber-500/25 bg-amber-500/10",
  bad: "border-white/10 bg-surface-base/60",
} as const;

function StatusIcon({ tone }: { tone: "good" | "warn" | "bad" }) {
  const Icon = tone === "good" ? Check : tone === "warn" ? Clock : AlertTriangle;

  return (
    <span
      aria-hidden
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        tone === "good"
          ? "bg-accent-strong text-black"
          : tone === "warn"
            ? "bg-amber-500/20 text-amber-300"
            : "bg-white/5 text-zinc-300"
      }`}
    >
      <Icon size={17} strokeWidth={tone === "good" ? 3 : 2} />
    </span>
  );
}

/** One fact about what the account can do, stated as a sentence rather
 *  than a green tick a DJ has to interpret. */
function Capability({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-start gap-2 text-[13px] leading-5">
      {/* Never colour alone: the word Yes or No carries it, and the mark
          is aria-hidden decoration on top. */}
      <span
        aria-hidden
        className={ok ? "text-accent" : "text-zinc-500"}
      >
        {ok ? "✓" : "✕"}
      </span>
      <span className="text-zinc-300">
        {label}{" "}
        <span className={ok ? "font-semibold text-accent" : "font-semibold text-zinc-400"}>
          {ok ? "Yes" : "No"}
        </span>
      </span>
    </li>
  );
}

function PaymentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /*
   * A DJ arriving from a recovery email is arriving from setup, so the
   * back-to-setup affordance must behave exactly as it did before. The
   * marker changed only so that an email click is distinguishable from
   * the Onboarding screen's own buttons; it did not change where the DJ
   * is in the product.
   */
  const from = searchParams.get("from");
  const cameFromOnboarding = from === "onboarding" || from === "recovery_1" || from === "recovery_2";

  useLifecycleEmailReturn(from);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [openingStripe, setOpeningStripe] = useState(false);
  const [actionError, setActionError] = useState("");
  const [needsSupport, setNeedsSupport] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  };

  const checkStatus = useCallback(
    async (announce = false) => {
      setStatusError("");

      try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
          router.push("/login");
          return null;
        }

        const response = await fetch("/api/stripe/connect/status", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) throw new Error(result.error);

        setStatus(result as StatusResponse);

        if (announce) {
          setAnnouncement(
            result.reachable
              ? `Status updated: ${STATE_COPY[(result.health as ConnectHealth).state].title}`
              : "Status could not be checked"
          );
        }

        return result as StatusResponse;
      } catch (caughtError) {
        console.log("Connect status error:", caughtError);
        /*
         * Unknown stays unknown. The old page left `status` null here
         * and fell through to its "not connected" branch, which invited
         * a perfectly healthy DJ to start onboarding again because we
         * failed to load a page.
         */
        setStatusError("We couldn't check your Stripe status.");
        if (announce) setAnnouncement("Status could not be checked");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const startOnboarding = useCallback(async () => {
    if (connecting) return;

    setConnecting(true);
    setActionError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.push("/login");
        return;
      }

      const accountResponse = await fetch("/api/stripe/connect/account", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const accountResult = await accountResponse.json();

      if (!accountResponse.ok) {
        /*
         * Stripe made an account we could not record. Offering the
         * button again is exactly how a second account gets created, so
         * this locks the flow and asks for a human instead.
         */
        if (accountResult.code === "account_created_not_linked") {
          setNeedsSupport(true);
        }

        throw new Error(accountResult.error);
      }

      const onboardingResponse = await fetch("/api/stripe/connect/onboarding", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const onboardingResult = await onboardingResponse.json();

      if (!onboardingResponse.ok || !onboardingResult.url) {
        throw new Error(onboardingResult.error);
      }

      const stripeUrl = onboardingResult.url;

      if (typeof stripeUrl !== "string" || !stripeUrl.startsWith("https://")) {
        throw new Error("Stripe did not return a valid onboarding link.");
      }

      window.location.href = stripeUrl;
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "Unable to start Stripe setup."
      );
      setConnecting(false);
    }
  }, [connecting, router]);

  const openStripe = async () => {
    if (openingStripe) return;

    setOpeningStripe(true);
    setActionError("");

    /*
     * Opened synchronously inside the click so the browser still treats
     * it as user-initiated. Waiting for the fetch first gets it blocked.
     */
    const newWindow = window.open("", "_blank");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        newWindow?.close();
        router.push("/login");
        return;
      }

      const response = await fetch("/api/stripe/connect/dashboard-link", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        /* Not far enough into onboarding for a dashboard: Stripe's
           hosted setup is the right destination instead. */
        if (result.code === "onboarding_incomplete") {
          newWindow?.close();
          await startOnboarding();
          return;
        }

        throw new Error(result.error);
      }

      if (newWindow) newWindow.location.href = result.url;
      else window.location.href = result.url;
    } catch (caughtError) {
      newWindow?.close();
      setActionError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "Unable to open Stripe."
      );
    } finally {
      setOpeningStripe(false);
    }
  };

  /*
   * One status check per arrival, and one onboarding restart only on the
   * explicit refresh return.
   *
   * The old effect listed startOnboarding in its dependencies, and
   * calling it set state that startOnboarding closes over — so its
   * identity changed, the effect re-ran, and a second Stripe account
   * retrieve plus a database write went out on every return from Stripe.
   * The ref makes arrival handling happen once regardless of how many
   * times the effect is re-evaluated.
   */
  const handledArrival = useRef(false);

  useEffect(() => {
    if (handledArrival.current) return;
    handledArrival.current = true;

    (async () => {
      const result = await checkStatus();

      if (
        searchParams.get("connect") === "refresh" &&
        result?.reachable &&
        !result.health.canReceiveEarnings
      ) {
        await startOnboarding();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const health = status?.reachable ? status.health : null;
  const unreachable = status && !status.reachable ? status : null;

  const back = () =>
    router.push(cameFromOnboarding ? "/dj/dashboard" : "/dj/settings");

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Payments</h1>

      <Button
        variant="secondary"
        className="h-11 shrink-0 px-4 text-[13px]"
        onClick={back}
      >
        {cameFromOnboarding ? "Onboarding" : "Settings"}
      </Button>
    </div>
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="mt-4 h-32 rounded-card" />
          <p className="sr-only" role="status">
            Checking your Stripe status
          </p>
        </div>
      </main>
    );
  }

  const copy = health ? STATE_COPY[health.state] : null;

  return (
    <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
      <section className="mx-auto max-w-3xl">
        {header}

        {/* Announced once per explicit refresh, not on every render. */}
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {/* ── 1. Payment status ────────────────────────────────────── */}
        {statusError || unreachable ? (
          <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <StatusIcon tone="bad" />

              <div className="min-w-0">
                <h2 className="text-sm font-bold">
                  {unreachable ? "Can't read your Stripe account" : "Status unknown"}
                </h2>

                <p className="mt-1 text-[13px] leading-5 text-zinc-400">
                  {unreachable
                    ? UNREACHABLE_COPY[unreachable.reason]
                    : "We couldn't check your Stripe status just now. This is a loading problem, not a problem with your account or your money."}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <Button
                className="h-11 px-4 text-[13px]"
                onClick={() => checkStatus(true)}
              >
                Try again
              </Button>

              {/* No Start setup button here. We do not know whether an
                  account exists, and offering to create one is how a
                  duplicate gets made. */}
              {unreachable && unreachable.reason !== "temporary" && (
                <Button
                  variant="secondary"
                  className="h-11 px-4 text-[13px]"
                  onClick={() =>
                    (window.location.href =
                      "mailto:elliot@playingnextapp.com?subject=Stripe%20account%20needs%20reattaching")
                  }
                >
                  Contact us
                </Button>
              )}
            </div>
          </div>
        ) : (
          health &&
          copy && (
            <>
              <div
                className={`mt-4 rounded-card border p-4 sm:p-6 ${toneClasses[copy.tone]}`}
              >
                <div className="flex items-start gap-3">
                  <StatusIcon tone={copy.tone} />

                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold">{copy.title}</h2>

                    <p className="mt-1 text-[13px] leading-5 text-zinc-300">
                      {copy.body}
                    </p>

                    {/* The two truths, always both stated, so neither is
                        inferred from the headline. */}
                    <ul className="mt-3 space-y-1">
                      <Capability
                        label="Can receive Playing Next earnings"
                        ok={health.canReceiveEarnings}
                      />
                      <Capability
                        label="Can pay out to your bank"
                        ok={health.canPayOut}
                      />
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2.5">
                  {health.state === "not_connected" ? (
                    <Button
                      className="h-11 px-4 text-[13px]"
                      onClick={startOnboarding}
                      disabled={connecting || needsSupport}
                    >
                      {connecting ? "Opening Stripe..." : "Connect Stripe"}
                    </Button>
                  ) : health.detailsSubmitted ? (
                    <Button
                      className="h-11 px-4 text-[13px]"
                      onClick={openStripe}
                      disabled={openingStripe}
                    >
                      {openingStripe ? "Opening..." : "Manage in Stripe"}
                      <ExternalLink size={13} aria-hidden className="ml-1.5" />
                    </Button>
                  ) : (
                    <Button
                      className="h-11 px-4 text-[13px]"
                      onClick={startOnboarding}
                      disabled={connecting || needsSupport}
                    >
                      {connecting ? "Opening Stripe..." : "Finish setup"}
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    className="h-11 px-4 text-[13px]"
                    onClick={() => checkStatus(true)}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {/* ── 2. Action required ─────────────────────────────── */}
              {(health.requirementsDue > 0 ||
                health.restriction !== "none") && (
                <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
                  <h2 className="text-sm font-bold">
                    {health.restriction === "verification_pending"
                      ? "Stripe is checking your details"
                      : "Stripe needs something from you"}
                  </h2>

                  {/*
                    Translated, never dumped. Stripe's requirement keys
                    are internal identifiers, and the hosted flow it
                    sends the DJ into already names exactly what it
                    wants in its own words.
                  */}
                  <p className="mt-1 text-[13px] leading-5 text-zinc-400">
                    {health.restriction === "verification_pending"
                      ? "Nothing to do for now. Stripe is reviewing what you sent and payouts resume on their own once it clears."
                      : health.restriction === "restricted"
                        ? "Stripe has restricted this account. Open Stripe to see what they need and to appeal if you think it is wrong."
                        : health.canReceiveEarnings
                          ? "Your earnings are still arriving and are safe in your Stripe balance. Stripe needs this before payouts to your bank continue."
                          : "Stripe needs this before your account can receive earnings."}
                  </p>

                  {health.restriction !== "verification_pending" && (
                    <Button
                      className="mt-3.5 h-11 px-4 text-[13px]"
                      onClick={openStripe}
                      disabled={openingStripe}
                    >
                      {openingStripe ? "Opening..." : "Sort this out in Stripe"}
                      <ExternalLink size={13} aria-hidden className="ml-1.5" />
                    </Button>
                  )}
                </div>
              )}

              {/* ── 3. Payouts go to ───────────────────────────────── */}
              {health.destination && (
                <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
                  <h2 className="text-sm font-bold">Payouts go to</h2>

                  <p className="mt-2 flex items-center gap-2 text-[13px] text-zinc-300">
                    <Building2 size={15} aria-hidden className="text-zinc-400" />
                    <span>
                      {health.destination.bankName ?? "Your bank"}
                      {health.destination.last4 && (
                        <span className="text-zinc-400">
                          {" "}
                          ending {health.destination.last4}
                        </span>
                      )}
                    </span>
                  </p>

                  {health.destination.schedule === "manual" && (
                    <p className="mt-2 text-xs leading-5 text-zinc-400">
                      Payouts are manual, so your balance stays with Stripe
                      until you withdraw it.
                    </p>
                  )}

                  <p className="mt-2 text-xs leading-5 text-zinc-400">
                    Bank details live with Stripe and are changed there.
                  </p>
                </div>
              )}

              {/* ── 4. Your money ──────────────────────────────────── */}
              <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
                <h2 className="text-sm font-bold">Your money</h2>

                <p className="mt-1 text-[13px] leading-5 text-zinc-400">
                  Your balance, withdrawals and payout history are on your
                  earnings page.
                </p>

                <Button
                  variant="secondary"
                  className="mt-3.5 h-11 px-4 text-[13px]"
                  onClick={() => router.push("/dj/earnings")}
                >
                  Go to Earnings
                </Button>
              </div>
            </>
          )
        )}

        {needsSupport && (
          <div className="mt-4 rounded-card border border-amber-500/25 bg-amber-500/10 p-4 text-[13px] leading-5 text-amber-200 sm:p-6">
            Your Stripe account exists but is not linked to your profile.
            Please contact us rather than trying again, so we can attach the
            account you already have instead of creating a second one.
          </div>
        )}

        {actionError && (
          <p
            role="alert"
            className="mt-4 rounded-control border border-status-declined/25 bg-status-declined/10 p-3.5 text-[13px] leading-5 text-status-declined"
          >
            {actionError}
          </p>
        )}
      </section>
    </main>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
          <div className="mx-auto max-w-3xl">
            <Skeleton className="h-40 rounded-card" />
            <p className="sr-only" role="status">
              Checking your Stripe status
            </p>
          </div>
        </main>
      }
    >
      <PaymentsPageContent />
    </Suspense>
  );
}
