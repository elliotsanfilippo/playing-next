"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Card from "@/src/components/ui/Card";
import Badge from "@/src/components/ui/Badge";
import Button, { buttonVariants } from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";
import { requestStatusTone } from "@/src/lib/requestStatus";

type SongRequest = {
  id: string;
  song_title: string;
  artist: string;
  message: string | null;
  request_type: string | null;
  request_status: string;
  queue_position: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  checkout_pending: "Confirming Payment",
  pending: "Waiting for DJ",
  accepted: "In Queue",
  playing_next: "Playing Next",
  played: "Played",
  declined: "Declined",
};

export default function MyRequestsPage() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  const [requests, setRequests] = useState<SongRequest[]>([]);

  const clearMyRequests = () => {
    localStorage.removeItem(`myRequestIds_${djSlug}`);
    setRequests([]);
  };

  const fetchRequests = async () => {
    const myRequestIds = JSON.parse(
      localStorage.getItem(`myRequestIds_${djSlug}`) || "[]"
    );

    if (myRequestIds.length === 0) {
      setRequests([]);
      return;
    }

    const response = await fetch("/api/my-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestIds: myRequestIds,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.log(result.error);
      return;
    }

    setRequests(result.requests || []);
  };

  useEffect(() => {
    fetchRequests();

    /*
     * Polling rather than realtime: this page identifies "my requests"
     * purely via localStorage IDs, with no way to authenticate as their
     * owner, so it can't rely on a realtime subscription that depends on
     * unrestricted public read access to song_requests.
     */
    const interval = setInterval(() => {
      fetchRequests();
    }, 4000);

    return () => {
      clearInterval(interval);
    };
  }, [djSlug]);

  const sortedRequests = [...requests].sort((a, b) => {
    const order: Record<string, number> = {
      playing_next: 1,
      accepted: 2,
      pending: 3,
      checkout_pending: 3,
      played: 4,
      declined: 5,
    };

    const statusOrder =
      (order[a.request_status] || 999) - (order[b.request_status] || 999);

    if (statusOrder !== 0) {
      return statusOrder;
    }

    if (a.request_status === "accepted") {
      return (a.queue_position || 999) - (b.queue_position || 999);
    }

    return 0;
  });

  return (
    <main className="min-h-screen bg-canvas p-5 text-white sm:p-6">
      <section className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow tone="accent">Playing Next</Eyebrow>
            <h1 className="mt-2 text-h1">My Requests</h1>
            <p className="mt-2 text-zinc-400">
              Track your song requests from this device.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/request/${djSlug}`}
              className={buttonVariants({ size: "sm" })}
            >
              Request More
            </Link>

            <Button
              variant="secondary"
              size="sm"
              onClick={clearMyRequests}
            >
              Clear History
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {requests.length === 0 ? (
            <Card variant="elevated" className="p-8 text-center text-zinc-400">
              No requests from this device yet.
            </Card>
          ) : (
            sortedRequests.map((request) => (
              <Card
                key={request.id}
                variant="elevated"
                className="p-5 sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Badge tone={requestStatusTone(request.request_status)} dot>
                      {STATUS_LABEL[request.request_status] ||
                        request.request_status}
                    </Badge>

                    <h2 className="mt-4 text-h3">{request.song_title}</h2>

                    <p className="mt-1 text-zinc-400">{request.artist}</p>

                    {request.request_type === "song_message" && (
                      <div className="mt-4 rounded-control border border-white/10 bg-black/30 p-4">
                        <Eyebrow>Your Message</Eyebrow>

                        <p className="mt-2 text-sm text-white">
                          {request.message}
                        </p>
                      </div>
                    )}

                    {request.request_status === "accepted" && (
                      <p className="mt-4 text-sm font-semibold text-accent">
                        Queue Position #{request.queue_position}
                      </p>
                    )}

                    {request.request_status === "playing_next" && (
                      <p className="mt-4 text-sm font-semibold text-sky-300">
                        The DJ is about to play your request.
                      </p>
                    )}

                    {request.request_status === "declined" && (
                      <p className="mt-4 text-sm text-zinc-400">
                        You have not been charged.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
