import type { DJProfile } from "@/src/types/dashboard";

type Props = {
  djProfile: DJProfile;
  qrCodeUrl: string;
  onboardingComplete: boolean;
  router: {
    push: (path: string) => void;
  };
  onContinue: () => void | Promise<void>;
};

export default function Onboarding({
  djProfile,
  qrCodeUrl,
  onboardingComplete,
  router,
  onContinue,
}: Props) {
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
      complete: Boolean(qrCodeUrl),
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
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-10">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-green-500/15 text-3xl">
              🎧
            </div>

            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.22em] text-green-400">
              Welcome to Playing Next
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Let&apos;s get you ready
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Complete your setup so guests can find you, request songs and
              send payments.
            </p>
          </div>

          <div className="mt-8">
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
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className={`rounded-3xl border p-5 transition ${
                  step.complete
                    ? "border-green-500/15 bg-green-500/5"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold ${
                        step.complete
                          ? "bg-green-500 text-black"
                          : "bg-white/5 text-zinc-400"
                      }`}
                    >
                      {step.complete ? "✓" : index + 1}
                    </div>

                    <div>
                      <h2 className="font-semibold">{step.title}</h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {!step.complete && (
                    <button
                      type="button"
                      onClick={step.onClick}
                      className="h-11 rounded-2xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 active:scale-[0.98]"
                    >
                      {step.action}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            {nextIncompleteStep && (
              <button
                type="button"
                onClick={nextIncompleteStep.onClick}
                className="h-12 w-full rounded-2xl bg-green-500 px-6 font-semibold text-black transition hover:bg-green-400 active:scale-[0.98]"
              >
                Continue setup
              </button>
            )}

            <button
              type="button"
              onClick={onContinue}
              disabled={!onboardingComplete}
              className="w-full rounded-2xl bg-white px-6 py-4 font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:hover:bg-zinc-800"
            >
              Continue to Dashboard
            </button>

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