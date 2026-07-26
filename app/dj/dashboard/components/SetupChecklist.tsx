import type { DJProfile } from "@/src/types/dashboard";
type Props = {
  djProfile: DJProfile | null;
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

          <div className="mt-6 space-y-4">

  <div className="rounded-2xl bg-zinc-950 p-5">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-semibold">
          {djProfile.dj_name !== "New DJ"
            ? "✅ Profile complete"
            : "Choose your DJ name"}
        </h3>

        <p className="mt-1 text-sm text-zinc-500">
          This is what guests will see.
        </p>
      </div>

      {djProfile.dj_name === "New DJ" && (
        <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
          Edit
        </button>
      )}
    </div>
  </div>

  <div className="rounded-2xl bg-zinc-950 p-5">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-semibold">
          {(djProfile.request_price || 0) > 0
            ? "✅ Request price set"
            : "Set request price"}
        </h3>

        <p className="mt-1 text-sm text-zinc-500">
          Guests can't send requests until you set a price.
        </p>
      </div>

      {(djProfile.request_price || 0) === 0 && (
        <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
          Set Price
        </button>
      )}
    </div>
  </div>

</div>
        </div>
      )}
    </>
  );
}