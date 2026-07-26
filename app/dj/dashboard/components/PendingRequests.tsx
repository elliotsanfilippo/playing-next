import type { SongRequest } from "@/src/types/dashboard";
type Props = {
  pendingRequests: SongRequest[];

acceptRequest: (request: SongRequest) => Promise<void>;

declineRequest: (request: SongRequest) => Promise<void>;
};

export default function PendingRequests({
  pendingRequests,
  acceptRequest,
  declineRequest,
}: Props) {
  return (
    <>
    <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Pending Requests</h2>

            <div className="rounded-full bg-yellow-500/20 px-4 py-2 text-sm text-yellow-400">
              {pendingRequests.length}
            </div>
          </div>

          <div className="space-y-4">
            {pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-center">
                <p className="font-semibold text-zinc-300">
                  Waiting for requests...
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Share your QR code with the crowd.
                </p>
              </div>
            ) : (
              pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-white/10 bg-zinc-950 p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{request.song_title}</h3>

                      <p className="text-sm text-zinc-400">
                        {request.artist}
                      </p>

                      {request.request_type === "song_message" && (
                        <div className="mt-3 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">
                            Shoutout Message
                          </p>

                          <p className="mt-1 text-sm text-white">
                            {request.message || "No message provided"}
                          </p>
                        </div>
                      )}

                      <p className="mt-2 text-xs text-zinc-500">
                        {request.stripe_payment_intent_id
                          ? "Payment authorised"
                          : "No payment attached"}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => declineRequest(request)}
                        className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold"
                      >
                        Decline
                      </button>

                      <button
                        onClick={() => acceptRequest(request)}
                        className="rounded-full bg-green-500 px-4 py-2 text-sm font-semibold text-black"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
    </>
  );
}