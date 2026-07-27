type Props = {
  qrCodeUrl: string;
  requestLink: string;
  onContinue: () => void;
};

export default function LaunchComplete({
  qrCodeUrl,
  requestLink,
  onContinue,
}: Props) {
  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center">
        <section className="w-full overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 text-center shadow-2xl shadow-black/30 sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-green-500/15 text-4xl">
            🎉
          </div>

          <p className="mt-7 text-sm font-semibold uppercase tracking-[0.22em] text-green-400">
            Setup complete
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
            You&apos;re live!
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Your request page is ready. Guests can now scan your QR code and
            send song requests directly to your dashboard.
          </p>

          {qrCodeUrl && (
            <div className="mx-auto mt-8 w-fit rounded-[28px] bg-white p-5 shadow-2xl">
              <img
                src={qrCodeUrl}
                alt="Playing Next request QR code"
                className="w-52 sm:w-64"
              />
            </div>
          )}

          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
            <p className="truncate text-sm text-zinc-400">
              {requestLink}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onContinue}
              className="h-12 flex-1 rounded-2xl bg-green-500 px-6 font-semibold text-black transition hover:bg-green-400 active:scale-[0.98]"
            >
              View Dashboard
            </button>

            <a
              href={requestLink}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
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