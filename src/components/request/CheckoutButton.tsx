import Button from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";

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
    requestType === "song_message" ? shoutoutPrice : requestPrice;

  const totalAmount = requestAmount + SERVICE_FEE;

  const requestLabel =
    requestType === "song_message" ? "Song + Message" : "Song Request";

  return (
    <section className="overflow-hidden rounded-card border border-white/10 bg-black/30">
      <div className="border-b border-white/5 px-5 py-5 sm:px-6">
        <Eyebrow>Order summary</Eyebrow>

        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400">{requestLabel}</span>

            <span className="font-semibold text-white">
              £{(requestAmount / 100).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-zinc-400">Guest Service Fee</p>

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
            <p className="text-sm text-zinc-500">Total</p>

            <p className="mt-1 text-sm text-zinc-400">
              Charged only if the DJ accepts
            </p>
          </div>

          <p className="text-3xl font-bold tracking-tight">
            £{(totalAmount / 100).toFixed(2)}
          </p>
        </div>

        <Button
          size="lg"
          className="mt-5 w-full"
          disabled={!selectedSong || !isTakingRequests}
          onClick={onCheckout}
        >
          {!isTakingRequests
            ? "Requests Paused"
            : selectedSong
              ? `Continue to Payment · £${(totalAmount / 100).toFixed(2)}`
              : "Select a Song First"}
        </Button>

        <p className="mt-4 text-center text-xs text-zinc-600">
          Secure payment powered by Stripe
        </p>
      </div>
    </section>
  );
}
