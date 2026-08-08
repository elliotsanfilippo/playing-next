import { Music2, Mic, Crown } from "lucide-react";
import { Textarea } from "@/src/components/ui/Input";
import { VIP_PRICE } from "@/src/lib/pricing";

type Props = {
  requestType: "song_request" | "song_message";
  setRequestType: (
    value: "song_request" | "song_message"
  ) => void;
  requestPrice: number;
  shoutoutPrice: number;
  message: string;
  setMessage: (value: string) => void;
  isTakingRequests: boolean;
  isVip: boolean;
  setIsVip: (value: boolean) => void;
  vipAvailable: boolean;
};

export default function RequestOptions({
  requestType,
  setRequestType,
  requestPrice,
  shoutoutPrice,
  message,
  setMessage,
  isTakingRequests,
  isVip,
  setIsVip,
  vipAvailable,
}: Props) {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold">Choose your request</h3>

      <p className="mt-2 text-zinc-400">
        Select how you'd like to send your request.
      </p>

      <div className="mt-6 space-y-4">
        <button
          type="button"
          disabled={!isTakingRequests}
          onClick={() => setRequestType("song_request")}
          className={`w-full rounded-card border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
            requestType === "song_request"
              ? "border-accent bg-accent/10"
              : "border-white/10 bg-white/[0.03] hover:border-accent/20"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="flex items-center gap-2 text-lg font-bold">
                <Music2 size={18} className="text-accent" /> Song Request
              </h4>

              <p className="mt-2 text-sm text-zinc-400">
                Request a song for the DJ to play.
              </p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold">
                £{(requestPrice / 100).toFixed(2)}
              </p>

              {requestType === "song_request" && (
                <p className="mt-2 text-sm font-semibold text-accent">
                  Selected
                </p>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={!isTakingRequests}
          onClick={() => setRequestType("song_message")}
          className={`w-full rounded-card border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
            requestType === "song_message"
              ? "border-accent bg-accent/10"
              : "border-white/10 bg-white/[0.03] hover:border-accent/20"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="flex items-center gap-2 text-lg font-bold">
                <Mic size={18} className="text-accent" /> Song + Message
              </h4>

              <p className="mt-2 text-sm text-zinc-400">
                Include a personalised shoutout.
              </p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold">
                £{(shoutoutPrice / 100).toFixed(2)}
              </p>

              {requestType === "song_message" && (
                <p className="mt-2 text-sm font-semibold text-accent">
                  Selected
                </p>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={!isTakingRequests || (!isVip && !vipAvailable)}
          onClick={() => setIsVip(!isVip)}
          className={`w-full rounded-card border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
            isVip
              ? "border-amber-400/40 bg-amber-400/10"
              : "border-white/10 bg-white/[0.03] hover:border-amber-400/20"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="flex items-center gap-2 text-lg font-bold">
                <Crown size={18} className="text-amber-400" /> VIP Priority
              </h4>

              <p className="mt-2 text-sm text-zinc-400">
                {vipAvailable
                  ? "Jump the queue instantly once the DJ accepts. Only 3 VIP booths at a time."
                  : "VIP booths are full right now."}
              </p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold">
                +£{(VIP_PRICE / 100).toFixed(2)}
              </p>

              {isVip && (
                <p className="mt-2 text-sm font-semibold text-amber-400">
                  Added
                </p>
              )}
            </div>
          </div>
        </button>

        {requestType === "song_message" && (
          <Textarea
            disabled={!isTakingRequests}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your message..."
            rows={4}
            className="bg-black/30"
          />
        )}
      </div>
    </div>
  );
}
