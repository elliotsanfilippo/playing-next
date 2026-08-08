"use client";

import { useState } from "react";
import { Music2, Crown } from "lucide-react";
import type { SongRequest } from "@/src/types/dashboard";
import type { WidgetSize } from "@/src/lib/dashboardLayout";
import { cn } from "@/src/lib/cn";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";
import Eyebrow from "@/src/components/ui/Eyebrow";
import SizeToggle from "@/src/components/ui/SizeToggle";

type Props = {
  pendingRequests: SongRequest[];
  acceptRequest: (request: SongRequest) => Promise<void>;
  declineRequest: (request: SongRequest) => Promise<void>;
  size: WidgetSize;
  onSizeChange: (size: WidgetSize) => void;
  editable: boolean;
};

const listBySize: Record<WidgetSize, string> = {
  compact: "space-y-2 p-4 max-h-80 overflow-y-auto",
  normal: "space-y-4 p-6",
  large: "space-y-5 p-6",
};

const itemBySize: Record<WidgetSize, string> = {
  compact: "p-3",
  normal: "p-5",
  large: "p-6",
};

const titleBySize: Record<WidgetSize, string> = {
  compact: "text-lg",
  normal: "text-xl",
  large: "text-2xl",
};

export default function PendingRequests({
  pendingRequests,
  acceptRequest,
  declineRequest,
  size,
  onSizeChange,
  editable,
}: Props) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  return (
    <Card>
      <div className="border-b border-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow>Live</Eyebrow>

            <h2 className="mt-2 text-3xl font-bold">Pending Requests</h2>
          </div>

          <div className="flex items-center gap-3">
            {editable && <SizeToggle value={size} onChange={onSizeChange} />}

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15">
              <span className="text-xl font-bold text-amber-400">
                {pendingRequests.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={listBySize[size]}>
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
                className={cn(
                  "rounded-card border border-white/5 bg-zinc-950/60 transition hover:border-white/10 hover:bg-zinc-950",
                  itemBySize[size]
                )}
              >
                <div className="flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className={cn("truncate font-bold", titleBySize[size])}>
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

                  <div className="flex gap-3">
                    <Button
                      variant="danger"
                      className="flex-1"
                      disabled={processing}
                      onClick={async () => {
                        if (processing) return;

                        setProcessingId(request.id);

                        try {
                          await declineRequest(request);
                        } finally {
                          setProcessingId(null);
                        }
                      }}
                    >
                      {processing ? "Declining..." : "Decline"}
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
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
