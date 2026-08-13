"use client";

import { useState } from "react";
import { Music2, Crown } from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import { DECLINE_REASONS } from "@/src/lib/declineReasons";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";
import Eyebrow from "@/src/components/ui/Eyebrow";

type Props = {
  pendingRequests: SongRequest[];
  acceptRequest: (request: SongRequest) => Promise<void>;
  declineRequest: (
    request: SongRequest,
    declineReason?: string | null
  ) => Promise<void>;
};

export default function PendingRequests({
  pendingRequests,
  acceptRequest,
  declineRequest,
}: Props) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  /*
   * Which request is currently showing its reason picker. Declining
   * stays a two-tap action — tap Decline, tap a reason — rather than
   * opening a modal, because this gets used one-handed mid-set and a
   * dialog is the last thing a DJ wants over their queue.
   */
  const [choosingReasonId, setChoosingReasonId] = useState<string | null>(
    null
  );

  const runDecline = async (
    request: SongRequest,
    declineReason: string | null
  ) => {
    if (processingId) return;

    setProcessingId(request.id);

    try {
      await declineRequest(request, declineReason);
      setChoosingReasonId(null);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card>
      <div className="border-b border-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow>Live</Eyebrow>

            <h2 className="mt-2 text-3xl font-bold">Pending Requests</h2>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15">
            <span className="text-xl font-bold text-amber-400">
              {pendingRequests.length}
            </span>
          </div>
        </div>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto p-4">
        {pendingRequests.length === 0 ? (
          <div className="rounded-card border border-dashed border-white/10 p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-zinc-400">
              <Music2 size={24} />
            </div>

            <h3 className="text-lg font-semibold">No requests yet</h3>

            <p className="mt-2 text-sm text-zinc-500">
              Share your QR code and requests will appear here in real time.
            </p>
          </div>
        ) : (
          pendingRequests.map((request) => {
            const processing = processingId === request.id;

            return (
              <div
                key={request.id}
                className="rounded-card border border-white/5 bg-zinc-950/60 p-3 transition hover:border-white/10 hover:bg-zinc-950"
              >
                <div className="flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold">
                        {request.song_title}
                      </h3>

                      <p className="mt-1 text-zinc-400">{request.artist}</p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {request.is_vip && (
                        <Badge tone="warning">
                          <Crown size={12} /> VIP
                        </Badge>
                      )}

                      {request.stripe_payment_intent_id && (
                        <Badge tone="accent">Paid</Badge>
                      )}
                    </div>
                  </div>

                  {request.request_type === "song_message" &&
                    request.message && (
                      <div className="rounded-control border border-white/5 bg-white/5 p-4">
                        <Eyebrow>Shoutout</Eyebrow>

                        <p className="mt-2 italic text-zinc-200">
                          “{request.message}”
                        </p>
                      </div>
                    )}

                  {choosingReasonId === request.id ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <Eyebrow>Why? (optional)</Eyebrow>

                        <button
                          type="button"
                          disabled={processing}
                          onClick={() => setChoosingReasonId(null)}
                          className="text-sm font-semibold text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
                        >
                          Back
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {DECLINE_REASONS.map((reason) => (
                          <button
                            key={reason.key}
                            type="button"
                            disabled={processing}
                            onClick={() => runDecline(request, reason.key)}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
                          >
                            {reason.djLabel}
                          </button>
                        ))}

                        <button
                          type="button"
                          disabled={processing}
                          onClick={() => runDecline(request, null)}
                          className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-500 underline underline-offset-4 transition hover:text-zinc-300 disabled:opacity-50"
                        >
                          {processing ? "Declining..." : "Skip"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button
                        variant="danger"
                        className="flex-1"
                        disabled={processing}
                        onClick={() => setChoosingReasonId(request.id)}
                      >
                        Decline
                      </Button>

                      <Button
                        className="flex-1"
                        disabled={processing}
                        onClick={async () => {
                          if (processing) return;

                          setProcessingId(request.id);

                          try {
                            await acceptRequest(request);
                          } finally {
                            setProcessingId(null);
                          }
                        }}
                      >
                        {processing ? "Accepting..." : "Accept"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
