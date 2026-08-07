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
};

export default function RequestOptions({
  requestType,
  setRequestType,
  requestPrice,
  shoutoutPrice,
  message,
  setMessage,
  isTakingRequests,
}: Props) {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold">
        Choose your request
      </h3>

      <p className="mt-2 text-zinc-400">
        Select how you'd like to send your request.
      </p>

      <div className="mt-6 space-y-4">
        <button
          type="button"
          disabled={!isTakingRequests}
          onClick={() => setRequestType("song_request")}
          className={`w-full rounded-3xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
            requestType === "song_request"
              ? "border-green-500 bg-green-500/10"
              : "border-white/10 bg-white/[0.03] hover:border-green-500/20"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold">
                🎵 Song Request
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
                <p className="mt-2 text-sm font-semibold text-green-400">
                  Selected
                </p>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={!isTakingRequests}
          onClick={() =>
            setRequestType("song_message")
          }
          className={`w-full rounded-3xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
            requestType === "song_message"
              ? "border-green-500 bg-green-500/10"
              : "border-white/10 bg-white/[0.03] hover:border-green-500/20"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold">
                🎤 Song + Message
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
                <p className="mt-2 text-sm font-semibold text-green-400">
                  Selected
                </p>
              )}
            </div>
          </div>
        </button>

        {requestType === "song_message" && (
          <textarea
            disabled={!isTakingRequests}
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            placeholder="Write your message..."
            rows={4}
            className="w-full rounded-3xl border border-white/10 bg-black/30 p-5 text-white outline-none placeholder:text-zinc-600 disabled:opacity-40"
          />
        )}
      </div>
    </div>
  );
}