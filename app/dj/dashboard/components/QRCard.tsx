type Props = {
  showQr: boolean;
  setShowQr: (value: boolean) => void;
  qrCodeUrl: string;
  requestLink: string;
  displayRequestLink: string;
};

export default function QRCard({
  showQr,
  setShowQr,
  qrCodeUrl,
  requestLink,
  displayRequestLink,
}: Props) {
  return (
    <>
    <div className="mt-6 rounded-3xl border border-white/10 bg-zinc-900 p-5">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-xl font-semibold">
        Request QR
      </h2>

      <p className="mt-1 text-sm text-zinc-500">
        Share your request link with the crowd.
      </p>
    </div>

    <button
      onClick={() => setShowQr(!showQr)}
      className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white"
    >
      {showQr ? "Hide QR" : "Show QR"}
    </button>
  </div>

  {showQr && (
    <div className="mt-6 flex flex-col items-center gap-4 text-center">
      {qrCodeUrl && (
        <img
          src={qrCodeUrl}
          alt="DJ Request QR Code"
          className="w-32 rounded-2xl bg-white p-2"
        />
      )}

      <div className="rounded-full bg-zinc-950 px-4 py-2 text-sm text-zinc-400">
        {displayRequestLink}
      </div>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <button
          onClick={() => navigator.clipboard.writeText(requestLink)}
          className="w-full rounded-full bg-white px-4 py-3 text-center text-sm font-semibold text-black sm:w-auto"
        >
          Copy Link
        </button>

        <a
          href={qrCodeUrl}
          download="playing-next-qr-code.png"
          className="w-full rounded-full border border-white/10 px-4 py-3 text-center text-sm font-semibold text-white sm:w-auto"
        >
          Download QR
        </a>
      </div>
    </div>
  )}
</div>
    </>
  );
}