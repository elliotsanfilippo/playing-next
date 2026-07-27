import type { SongRequest } from "@/src/types/dashboard";
import Card from "@/src/components/ui/Card";

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
    <Card>
      <div className="border-b border-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              LIVE
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              Pending Requests
            </h2>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15">
            <span className="text-xl font-bold text-amber-400">
              {pendingRequests.length}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {pendingRequests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-2xl">
              🎵
            </div>

            <h3 className="text-lg font-semibold">
              No requests yet
            </h3>

            <p className="mt-2 text-sm text-zinc-500">
              Share your QR code and requests will appear here in real time.
            </p>
          </div>
        ) : (
          pendingRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-3xl border border-white/5 bg-zinc-950/60 p-5 transition hover:border-white/10 hover:bg-zinc-950"
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-bold">
                      {request.song_title}
                    </h3>

                    <p className="mt-1 text-zinc-400">
                      {request.artist}
                    </p>
                  </div>

                  {request.stripe_payment_intent_id && (
                    <div className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400">
                      Paid
                    </div>
                  )}
                </div>

                {request.request_type === "song_message" &&
                  request.message && (
                    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        SHOUTOUT
                      </p>

                      <p className="italic text-zinc-200">
  “{request.message}”
</p>
                    </div>
                  )}

                <div className="flex gap-3">
                  <button
                    onClick={() => declineRequest(request)}
                    className="flex-1 rounded-2xl border border-red-500/20 bg-red-500/10 py-3 font-semibold text-red-400 transition hover:bg-red-500/20"
                  >
                    Decline
                  </button>

                  <button
                    onClick={() => acceptRequest(request)}
                    className="flex-1 rounded-2xl bg-white py-3 font-bold text-black transition hover:scale-[1.02] hover:bg-zinc-200 active:scale-100"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}