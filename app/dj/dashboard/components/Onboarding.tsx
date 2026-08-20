import { useState } from "react";
import { Headphones, Check } from "lucide-react";
import type { DJProfile } from "@/src/types/dashboard";
import Button from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";
import AddToHomeScreen from "./AddToHomeScreen";

type Props = {
  djProfile: DJProfile;
  onboardingComplete: boolean;
  router: {
    push: (path: string) => void;
  };
  onContinue: () => void | Promise<void>;
};

export default function Onboarding({
  djProfile,
  onboardingComplete,
  router,
  onContinue,
}: Props) {
  const [continuing, setContinuing] = useState(false);

  const handleContinue = async () => {
    if (continuing) return;

    setContinuing(true);

    try {
      await onContinue();
    } finally {
      setContinuing(false);
    }
  };

  const steps = [
    {
      title: "Complete your profile",
      description: "Set your DJ name and public profile details.",
      complete: djProfile.dj_name !== "New DJ",
      action: "Edit profile",
      onClick: () => router.push("/dj/settings?from=onboarding"),
    },
    {
      title: "Set your request price",
      description: "Choose how much guests pay to submit a song.",
      complete: (djProfile.request_price || 0) > 0,
      action: "Set pricing",
      onClick: () => router.push("/dj/settings?from=onboarding"),
    },
    {
      title: "Upload a profile photo",
      description: "Help guests recognise the correct DJ.",
      complete: Boolean(djProfile.profile_image_url),
      action: "Upload photo",
      onClick: () => router.push("/dj/settings?from=onboarding"),
    },
    {
      title: "Prepare your QR code",
      description: "Your crowd will scan this to open your request page.",
      /* Matches the dashboard's onboardingComplete check: the QR is
         derived from the profile slug, so the step is done once there
         is a link to encode. Testing the generated image instead made
         this tick flicker while the data URL was still being produced. */
      complete: Boolean(djProfile.slug),
      action: "View QR code",
      onClick: () => router.push("/dj/dashboard"),
    },
    {
      title: "Connect Stripe",
      description: "Receive request payments directly.",
      complete: Boolean(djProfile.stripe_connected),
      action: "Set up payments",
      onClick: () =>
        router.push("/dj/settings/payments?from=onboarding"),
    },
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const progress = (completedCount / steps.length) * 100;
  const nextIncompleteStep = steps.find((step) => !step.complete);

  return (
    <main className="min-h-screen bg-canvas px-5 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-card-lg border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-10">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-card bg-accent/15 text-accent">
              <Headphones size={28} />
            </div>

            <Eyebrow tone="accent" className="mt-6">
              Welcome to Playing Next
            </Eyebrow>

            <h1 className="mt-3 text-h1">Let&apos;s get you ready</h1>

            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Complete your setup so guests can find you, request songs and
              send payments.
            </p>
          </div>

          <div className="mt-8">
            <AddToHomeScreen />

            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-300">
                Setup progress
              </span>

              <span className="text-zinc-500">
                {completedCount} of {steps.length} complete
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-accent-strong transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className={`rounded-card border p-5 transition ${
                  step.complete
                    ? "border-accent/15 bg-accent/5"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold ${
                        step.complete
                          ? "bg-accent-strong text-black"
                          : "bg-white/5 text-zinc-400"
                      }`}
                    >
                      {step.complete ? (
                        <Check size={18} strokeWidth={3} />
                      ) : (
                        index + 1
                      )}
                    </div>

                    <div>
                      <h2 className="font-semibold">{step.title}</h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {!step.complete && (
                    <Button size="sm" onClick={step.onClick}>
                      {step.action}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            {nextIncompleteStep && (
              <Button
                variant="accent"
                className="w-full"
                onClick={nextIncompleteStep.onClick}
              >
                Continue setup
              </Button>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={handleContinue}
              disabled={!onboardingComplete || continuing}
            >
              {continuing ? "Loading..." : "Continue to Dashboard"}
            </Button>

            {!onboardingComplete && (
              <p className="text-center text-sm text-zinc-500">
                Complete every setup step before continuing.
              </p>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-zinc-600">
            You can return to setup from the dashboard at any time.
          </p>
        </div>
      </div>
    </main>
  );
}