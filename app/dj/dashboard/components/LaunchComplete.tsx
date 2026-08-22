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
    <main className="min-h-screen bg-canvas px-5 py-6 text-white sm:px-6 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-start sm:min-h-[calc(100vh-6rem)] sm:items-center">
        <section className="w-full overflow-hidden rounded-card-lg border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 text-center shadow-2xl shadow-black/30 sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-card bg-accent/15 text-accent sm:h-20 sm:w-20">
            <PartyPopper size={26} className="sm:hidden" />
            <PartyPopper size={36} className="hidden sm:block" />
          </div>

          <Eyebrow tone="accent" className="mt-5 sm:mt-7">
            Setup complete
          </Eyebrow>

          <h1 className="mt-3 text-display">You&apos;re live!</h1>

          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-zinc-400 sm:mt-4 sm:text-lg">
            Your request page is ready. Guests can now scan your QR code and
            send song requests directly to your dashboard.
          </p>

          {qrCodeUrl && (
            <div className="mx-auto mt-5 w-fit rounded-card bg-white p-4 shadow-2xl sm:mt-8 sm:p-5">
              {/* eslint-disable-next-line @next/next/no-img-element --
                  client-generated data: URL, nothing for next/image to
                  optimize. */}
              <img
                src={qrCodeUrl}
                alt="Playing Next request QR code"
                className="w-36 sm:w-64"
              />
            </div>
          )}

          <div className="mx-auto mt-5 max-w-xl rounded-control border border-white/5 bg-black/20 px-4 py-3 sm:mt-6">
            <p className="truncate text-sm text-zinc-400">
              {requestLink}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
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

          <p className="mt-4 text-xs text-zinc-600 sm:mt-5">
            This screen is shown once after setup is completed.
          </p>
        </section>
      </div>
    </main>
  );
}