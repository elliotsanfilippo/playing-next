"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellRing, Crown, Flag } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Badge from "@/src/components/ui/Badge";
import Button, { buttonVariants } from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";
import { requestStatusTone } from "@/src/lib/requestStatus";
import { declineReasonGuestCopy } from "@/src/lib/declineReasons";
import {
  getGuestNotificationsEnabled,
  requestNotificationPermission,
  setGuestNotificationsEnabled,
  showBrowserNotification,
} from "@/src/lib/notifications";

type SongRequest = {
  id: string;
  song_title: string;
  artist: string;
  message: string | null;
  request_type: string | null;
  request_status: string;
  queue_position: number | null;
  is_vip: boolean;
  decline_reason: string | null;
  reported_not_played_at: string | null;
};

const REPORTABLE_STATUSES = ["accepted", "playing_next", "played"];

const STATUS_LABEL: Record<string, string> = {
  checkout_pending: "Confirming Payment",
  pending: "Waiting for DJ",
  accepted: "In Queue",
  playing_next: "Playing Next",
  played: "Played",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

export default function MyRequestsPage() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reportOpenId, setReportOpenId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportingId, setReportingId] = useState<string | null>(null);

  const previousStatusesRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    setNotifyEnabled(getGuestNotificationsEnabled());
  }, []);

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();

    if (!granted) {
      toast.error(
        "Notifications are blocked. Enable them in your browser's site settings."
      );
      return;
    }

    setGuestNotificationsEnabled(true);
    setNotifyEnabled(true);
    toast.success("We'll let you know when any of these update.");
  };

  const cancelRequest = async (requestId: string) => {
    if (cancellingId) return;

    setCancellingId(requestId);

    try {
      const response = await fetch("/api/request/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to cancel this request.");
      }

      toast.success("Request cancelled. You have not been charged.");
      fetchRequests();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel this request."
      );
    } finally {
      setCancellingId(null);
    }
  };

  const submitNotPlayedReport = async (requestId: string) => {
    if (reportingId) return;

    setReportingId(requestId);

    try {
      const response = await fetch("/api/request/report-not-played", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, reason: reportReason }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to submit your report right now.");
      }

      toast.success("Thanks — we've logged this for review.");
      setReportOpenId(null);
      setReportReason("");
      fetchRequests();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to submit your report right now."
      );
    } finally {
      setReportingId(null);
    }
  };

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

    const freshRequests: SongRequest[] = result.requests || [];

    if (previousStatusesRef.current === null) {
      previousStatusesRef.current = new Map(
        freshRequests.map((request) => [request.id, request.request_status])
      );
    } else {
      const previous = previousStatusesRef.current;

      freshRequests.forEach((request) => {
        const previousStatus = previous.get(request.id);

        if (previousStatus && previousStatus !== request.request_status) {
          const label =
            STATUS_LABEL[request.request_status] || request.request_status;

          toast(request.song_title, { description: label });

          if (
            getGuestNotificationsEnabled() &&
            document.visibilityState !== "visible"
          ) {
            showBrowserNotification(request.song_title, label);
          }
        }

        previous.set(request.id, request.request_status);
      });
    }

    setRequests(freshRequests);
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
      cancelled: 5,
      expired: 5,
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
            {!notifyEnabled && (
              <Button
                variant="secondary"
                size="sm"
                onClick={enableNotifications}
              >
                <Bell size={16} className="mr-2" />
                Notify Me
              </Button>
            )}

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

        {notifyEnabled && (
          <p className="-mt-4 mb-6 flex items-center gap-2 text-sm font-semibold text-accent">
            <BellRing size={16} />
            We&apos;ll notify you when any of these update
          </p>
        )}

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
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={requestStatusTone(request.request_status)} dot>
                        {STATUS_LABEL[request.request_status] ||
                          request.request_status}
                      </Badge>

                      {request.is_vip && (
                        <Badge tone="warning">
                          <Crown size={12} /> VIP
                        </Badge>
                      )}
                    </div>

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

                    {(request.request_status === "declined" ||
                      request.request_status === "cancelled" ||
                      request.request_status === "expired") && (
                      <p className="mt-4 text-sm text-zinc-400">
                        {request.request_status === "declined" &&
                        declineReasonGuestCopy(request.decline_reason)
                          ? `${declineReasonGuestCopy(request.decline_reason)} You have not been charged.`
                          : "You have not been charged."}
                      </p>
                    )}

                    {request.reported_not_played_at && (
                      <p className="mt-4 flex items-center gap-1.5 text-sm text-zinc-400">
                        <Flag size={14} className="shrink-0" />
                        Reported as not played — we&apos;re looking into it.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    {request.request_status === "pending" && (
                      <button
                        type="button"
                        onClick={() => cancelRequest(request.id)}
                        disabled={cancellingId === request.id}
                        className="rounded-control border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {cancellingId === request.id
                          ? "Cancelling..."
                          : "Cancel"}
                      </button>
                    )}

                    {REPORTABLE_STATUSES.includes(request.request_status) &&
                      !request.reported_not_played_at && (
                        <button
                          type="button"
                          onClick={() => {
                            setReportOpenId(
                              reportOpenId === request.id ? null : request.id
                            );
                            setReportReason("");
                          }}
                          className="flex items-center gap-1.5 rounded-control border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/10"
                        >
                          <Flag size={14} />
                          This wasn&apos;t played
                        </button>
                      )}
                  </div>
                </div>

                {reportOpenId === request.id && (
                  <div className="mt-4 rounded-control border border-white/10 bg-black/30 p-4">
                    <p className="text-sm font-semibold text-white">
                      Didn&apos;t hear this one play?
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      We&apos;ll flag this DJ&apos;s account for review. Add any
                      detail that might help (optional).
                    </p>

                    <textarea
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value)}
                      placeholder="Optional details..."
                      rows={2}
                      maxLength={500}
                      className="mt-3 w-full rounded-control border border-white/10 bg-black/40 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-accent/40"
                    />

                    <div className="mt-3 flex gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setReportOpenId(null)}
                        disabled={reportingId === request.id}
                      >
                        Never mind
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => submitNotPlayedReport(request.id)}
                        disabled={reportingId === request.id}
                      >
                        {reportingId === request.id
                          ? "Submitting..."
                          : "Submit report"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
