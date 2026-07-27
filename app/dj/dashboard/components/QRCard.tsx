type Props = {
  showQr: boolean;
  setShowQr: (value: boolean) => void;
  qrCodeUrl: string;
  requestLink: string;
  displayRequestLink: string;
};

export default function QRCard({
  qrCodeUrl,
  requestLink,
  displayRequestLink,
}: Props) {
  return (
    <section className="mt-8 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950">
      <div className="p-8">

        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

          <div className="max-w-lg">

            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              SHARE
            </p>

            <h2 className="mt-3 text-4xl font-bold">
              Your Request Page
            </h2>

            <p className="mt-3 text-zinc-400">
              Guests simply scan your QR code to send song requests directly to
              your dashboard.
            </p>

            <div className="mt-6 rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="truncate text-sm text-zinc-400">
                {displayRequestLink}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">

              <button
                onClick={() =>
                  navigator.clipboard.writeText(requestLink)
                }
                className="rounded-2xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-zinc-200"
              >
                Copy Link
              </button>

              <a
                href={qrCodeUrl}
                download="playing-next-qr-code.png"
                className="rounded-2xl border border-white/10 px-6 py-3 font-semibold transition hover:bg-white/5"
              >
                Download QR
              </a>

            </div>

          </div>

          <div className="flex justify-center">

            {qrCodeUrl && (
              <div className="rounded-[28px] bg-white p-5 shadow-2xl">
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="w-56"
                />
              </div>
            )}

          </div>

        </div>

      </div>
    </section>
  );
}