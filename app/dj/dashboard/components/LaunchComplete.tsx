import { useState } from "react";
import { PartyPopper } from "lucide-react";
import Button from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";

type Props = {
  qrCodeUrl: string;
  requestLink: string;
  onContinue: () => Promise<void>;
};

export default function LaunchComplete({
  qrCodeUrl,
  requestLink,
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

  return (
    <main className="min-h-screen bg-canvas px-5 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center">
        <section className="w-full overflow-hidden rounded-card-lg border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 text-center shadow-2xl shadow-black/30 sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-card bg-accent/15 text-accent">
            <PartyPopper size={36} />
          </div>

          <Eyebrow tone="accent" className="mt-7">
            Setup complete
          </Eyebrow>

          <h1 className="mt-3 text-display">You&apos;re live!</h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Your request page is ready. Guests can now scan your QR code and
            send song requests directly to your dashboard.
          </p>

          {qrCodeUrl && (
            <div className="mx-auto mt-8 w-fit rounded-card bg-white p-5 shadow-2xl">
              <img
                src={qrCodeUrl}
                alt="Playing Next request QR code"
                className="w-52 sm:w-64"
              />
            </div>
          )}

          <div className="mx-auto mt-6 max-w-xl rounded-control border border-white/5 bg-black/20 px-4 py-3">
            <p className="truncate text-sm text-zinc-400">
              {requestLink}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="accent"
              className="flex-1"
              onClick={handleContinue}
              disabled={continuing}
            >
              {continuing ? "Loading..." : "View Dashboard"}
            </Button>

            <a
              href={requestLink}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 flex-1 items-center justify-center rounded-control border border-white/10 bg-white/5 px-6 font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
            >
              Open Request Page
            </a>
          </div>

          <p className="mt-5 text-xs text-zinc-600">
            This screen is shown once after setup is completed.
          </p>
        </section>
      </div>
    </main>
  );
}