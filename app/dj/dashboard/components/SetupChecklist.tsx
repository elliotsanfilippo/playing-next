type Props = {
  djProfile: any;
  qrCodeUrl: string;
};

export default function SetupChecklist({
  djProfile,
  qrCodeUrl,
}: Props) {
  return (
    <>
    {djProfile && (
        <div className="mt-6 rounded-3xl border border-white/10 bg-zinc-900 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-zinc-400">Setup Progress</p>

              <h2 className="mt-1 text-xl font-semibold">
                Setup Checklist
              </h2>
            </div>

            <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
              {
                [
                  djProfile.dj_name !== "New DJ",
                  (djProfile.request_price || 0) > 0,
                  Boolean(djProfile.profile_image_url),
                  Boolean(qrCodeUrl),
                  Boolean(djProfile.stripe_connected),
                ].filter(Boolean).length
              }
              /5 complete
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-950">
            <div
              className="h-full rounded-full bg-white"
              style={{
                width: `${
                  ([
                    djProfile.dj_name !== "New DJ",
                    (djProfile.request_price || 0) > 0,
                    Boolean(djProfile.profile_image_url),
                    Boolean(qrCodeUrl),
                    Boolean(djProfile.stripe_connected),
                  ].filter(Boolean).length /
                    5) *
                  100
                }%`,
              }}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-zinc-950 p-4">
              {djProfile.dj_name !== "New DJ" ? "✅" : "⬜"} Profile details
            </div>

            <div className="rounded-2xl bg-zinc-950 p-4">
              {(djProfile.request_price || 0) > 0 ? "✅" : "⬜"} Request prices
            </div>

            <div className="rounded-2xl bg-zinc-950 p-4">
              {djProfile.profile_image_url ? "✅" : "⬜"} Profile image
            </div>

            <div className="rounded-2xl bg-zinc-950 p-4">
              {qrCodeUrl ? "✅" : "⬜"} QR code ready
            </div>

            <div className="rounded-2xl bg-zinc-950 p-4 sm:col-span-2">
              {djProfile.stripe_connected ? "✅" : "⬜"} Connect Stripe
            </div>
          </div>
        </div>
      )}
    </>
  );
}