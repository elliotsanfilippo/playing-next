"use client";

import { useState } from "react";
import { Music2, Crown } from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import { DECLINE_REASONS } from "@/src/lib/declineReasons";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";
import Eyebrow from "@/src/components/ui/Eyebrow";
import RequestCard from "@/src/components/product/RequestCard";

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
      {/* Section headings are tool-scale, not marketing-scale. text-3xl
          here was competing with the requests themselves. */}
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-300">
          Needs you
        </h2>

        <span
          className={
            pendingRequests.length > 0
              ? "flex h-7 min-w-7 items-center justify-center rounded-full bg-status-pending-surface/15 px-2 text-sm font-bold tabular-nums text-status-pending"
              : "flex h-7 min-w-7 items-center justify-center rounded-full bg-white/5 px-2 text-sm font-bold tabular-nums text-zinc-500"
          }
        >
          {pendingRequests.length}
        </span>
      </div>

      {/*
        No max-height and no overflow-y here on purpose. This used to be
        a 320px scroll box inside a scrolling page, which capped the list
        at about four visible rows on any screen size and, on a phone,
        put a scroll trap around the most important content on the
        dashboard. The list now grows and the page scrolls.
      */}
      <div className="space-y-2 p-3 sm:p-4">
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
              <RequestCard
                key={request.id}
                title={request.song_title}
                artist={request.artist}
                isVip={request.is_vip}
                meta={
                  <>
                    {request.is_vip && (
                      <Badge tone="warning">
                        <Crown size={12} /> VIP
                      </Badge>
                    )}

                    {request.stripe_payment_intent_id && (
                      <Badge tone="accent">Paid</Badge>
                    )}
                  </>
                }
                actions={
                  choosingReasonId === request.id ? (
                    <div className="w-full">
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
                    <div className="flex w-full gap-3">
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
                  )
                }
              >
                {request.request_type === "song_message" &&
                  request.message && (
                    <div className="mt-4 rounded-control border border-white/5 bg-white/5 p-4">
                      <Eyebrow>Shoutout</Eyebrow>

                      <p className="mt-2 italic text-zinc-200">
                        “{request.message}”
                      </p>
                    </div>
                  )}
              </RequestCard>
            );
          })
        )}
      </div>
    </Card>
  );
}
