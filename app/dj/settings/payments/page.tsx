"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { supabase } from "../../../../src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";

type ConnectStatus = {
  hasAccount: boolean;
  connected: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  transfersActive: boolean;
  currentlyDue: string[];
};

async function readApiResponse(response: Response) {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch {
    console.error("Non-JSON API response:", responseText);

    return {
      error: `The server returned an unexpected response (${response.status}). Check the terminal for the underlying error.`,
    };
  }
}

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const cameFromOnboarding = searchParams.get("from") === "onboarding";

  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  };

  const checkStatus = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.push("/login");
        return null;
      }

      const response = await fetch("/api/stripe/connect/status", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to check your Stripe status."
        );
      }

      setStatus(result);
      return result as ConnectStatus;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to check your Stripe status.";

      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const startOnboarding = useCallback(async () => {
    if (connecting) return;

    setConnecting(true);
    setError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.push("/login");
        return;
      }

      const accountResponse = await fetch("/api/stripe/connect/account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const accountResult = await accountResponse.json();

      if (!accountResponse.ok) {
        throw new Error(
          accountResult.error || "Unable to create your Stripe account."
        );
      }

      const onboardingResponse = await fetch(
        "/api/stripe/connect/onboarding",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const onboardingResult = await readApiResponse(onboardingResponse);

      if (!onboardingResponse.ok || !onboardingResult.url) {
        throw new Error(
          onboardingResult.error || "Unable to start Stripe onboarding."
        );
      }

      const stripeUrl = onboardingResult.url;

      if (
        typeof stripeUrl !== "string" ||
        !stripeUrl.startsWith("https://")
      ) {
        throw new Error(
          onboardingResult.error ||
            "Stripe did not return a valid onboarding URL."
        );
      }

      window.location.href = stripeUrl;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to start Stripe onboarding.";

      setError(message);
      setConnecting(false);
    }
  }, [connecting, router]);

  useEffect(() => {
    const initialise = async () => {
      const result = await checkStatus();
      const connectResult = searchParams.get("connect");

      if (connectResult === "refresh" && result && !result.connected) {
        await startOnboarding();
      }
    };

    initialise();
  }, [checkStatus, searchParams, startOnboarding]);

  return (
    <main className="min-h-screen bg-canvas px-5 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() =>
            router.push(cameFromOnboarding ? "/dj/dashboard" : "/dj/settings")
          }
          className="mb-6 text-sm font-semibold text-zinc-400 transition hover:text-white"
        >
          {cameFromOnboarding ? "← Back to Onboarding" : "← Back to Settings"}
        </button>

        <Card variant="elevated" className="overflow-hidden">
          <div className="p-6 sm:p-10">
            <Eyebrow tone="accent">Payments</Eyebrow>

            <h1 className="mt-3 text-h1">Connect Stripe</h1>

            <p className="mt-4 max-w-xl leading-relaxed text-zinc-400">
              Connect securely with Stripe to receive payouts from guest
              song requests.
            </p>

            {loading ? (
              <div className="mt-8 animate-pulse rounded-card border border-white/5 bg-black/20 p-6">
                <div className="h-5 w-40 rounded bg-white/10" />
                <div className="mt-3 h-4 w-64 rounded bg-white/5" />
              </div>
            ) : status?.connected ? (
              <div className="mt-8 rounded-card border border-accent/20 bg-accent/10 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-strong text-black">
                    <Check size={20} strokeWidth={3} />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-green-300">
                      Stripe is connected
                    </h2>

                    <p className="mt-2 text-sm leading-relaxed text-green-100/70">
                      Your account is ready to receive transfers and
                      payouts.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-card border border-white/10 bg-black/20 p-6">
                <h2 className="text-xl font-semibold">
                  Complete Stripe onboarding
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Stripe will securely collect your identity, business and
                  bank details.
                </p>

                {status?.hasAccount && status.currentlyDue.length > 0 && (
                  <p className="mt-4 text-sm text-amber-300">
                    Stripe still requires additional account information.
                  </p>
                )}

                <Button
                  onClick={startOnboarding}
                  disabled={connecting}
                  className="mt-6 w-full sm:w-auto"
                >
                  {connecting
                    ? "Opening Stripe..."
                    : status?.hasAccount
                      ? "Continue Stripe Setup"
                      : "Connect Stripe"}
                </Button>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-control border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="secondary"
                onClick={checkStatus}
                disabled={loading}
              >
                Refresh status
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => router.push("/dj/dashboard")}
              >
                {cameFromOnboarding ? "Back to Onboarding" : "Back to Dashboard"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
