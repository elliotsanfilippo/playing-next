type Props = {
  selectedSong: boolean;
  isTakingRequests: boolean;
  requestType: "song_request" | "song_message";
  requestPrice: number;
  shoutoutPrice: number;
  onCheckout: () => void;
};

const SERVICE_FEE = 50;

export default function CheckoutButton({
  selectedSong,
  isTakingRequests,
  requestType,
  requestPrice,
  shoutoutPrice,
  onCheckout,
}: Props) {
  const requestAmount =
    requestType === "song_message"
      ? shoutoutPrice
      : requestPrice;

  const totalAmount = requestAmount + SERVICE_FEE;

  const requestLabel =
    requestType === "song_message"
      ? "Song + Message"
      : "Song Request";

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-black/30">
      <div className="border-b border-white/5 px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Order summary
        </p>

        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400">
              {requestLabel}
            </span>

            <span className="font-semibold text-white">
              £{(requestAmount / 100).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-zinc-400">
                Guest Service Fee
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Covers payment processing and platform costs.
              </p>
            </div>

            <span className="font-semibold text-white">
              £{(SERVICE_FEE / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">
              Total
            </p>

            <p className="mt-1 text-sm text-zinc-400">
              Charged only if the DJ accepts
            </p>
          </div>

          <p className="text-3xl font-bold tracking-tight">
            £{(totalAmount / 100).toFixed(2)}
          </p>
        </div>

        <button
          type="button"
          disabled={!selectedSong || !isTakingRequests}
          onClick={onCheckout}
          className="mt-5 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-white px-6 font-bold text-black transition hover:bg-zinc-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {!isTakingRequests
            ? "Requests Paused"
            : selectedSong
              ? `Continue to Payment · £${(
                  totalAmount / 100
                ).toFixed(2)}`
              : "Select a Song First"}
        </button>

        <p className="mt-4 text-center text-xs text-zinc-600">
          Secure payment powered by Stripe
        </p>
      </div>
    </section>
  );
}