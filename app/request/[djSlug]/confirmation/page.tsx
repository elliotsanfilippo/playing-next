"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Bell, BellRing, Crown, X } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Eyebrow from "@/src/components/ui/Eyebrow";
import { buttonVariants } from "@/src/components/ui/Button";
import { toneSurfaceClasses, toneDotClasses } from "@/src/components/ui/Badge";
import { requestStatusTone } from "@/src/lib/requestStatus";
import {
  getGuestNotificationsEnabled,
  requestNotificationPermission,
  setGuestNotificationsEnabled,
  showBrowserNotification,
} from "@/src/lib/notifications";

type SubmittedRequest = {
  id: string;
  song_title: string;
  artist: string;
  request_type: string | null;
  message: string | null;
  request_status: string;
  queue_position: number | null;
  is_vip: boolean;
};

const STATUS_COPY: Record<string, { label: string; description: string }> = {
  checkout_pending: {
    label: "Confirming Payment",
    description: "Your payment is being confirmed.",
  },
  pending: {
    label: "Pending Approval",
    description: "The DJ is reviewing your request.",
  },
  accepted: {
    label: "Request Accepted",
    description: "Your request has been added to the DJ’s queue.",
  },
  playing_next: {
    label: "Playing Next",
    description: "Get ready — your request is coming up.",
  },
  played: {
    label: "Played",
    description: "Your request has been played.",
  },
  declined: {
    label: "Request Declined",
    description:
      "The DJ could not accept this request. Your payment will not be captured.",
  },
  cancelled: {
    label: "Request Cancelled",
    description:
      "You cancelled this request. Your payment will not be captured.",
  },
  refunded: {
    label: "Refunded",
    description: "This payment has been refunded.",
  },
  disputed: {
    label: "Payment Disputed",
    description:
      "A dispute has been raised on this payment with your card issuer.",
  },
};

/*
 * The page header used to be a hardcoded celebration ("You're in.",
 * green tick) no matter the status, so a cancelled or declined request
 * still opened by congratulating the guest before contradicting itself
 * further down the page. Anything that ended without the song being
 * queued gets an honest header instead.
 */
const CLOSED_HEADER: Record<
  string,
  { eyebrow: string; heading: string; description: string }
> = {
  cancelled: {
    eyebrow: "Request cancelled",
    heading: "Cancelled.",
    description:
      "You cancelled this request, so you haven’t been charged for it.",
  },
  declined: {
    eyebrow: "Request declined",
    heading: "Not this time.",
    description:
      "The DJ couldn’t take this one, so you haven’t been charged for it.",
  },
  refunded: {
    eyebrow: "Request refunded",
    heading: "Refunded.",
    description: "This payment has been refunded to your card.",
  },
  disputed: {
    eyebrow: "Payment disputed",
    heading: "Payment disputed.",
    description:
      "A dispute has been raised on this payment with your card issuer.",
  },
};

function ConfirmationPageContent() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");

  const [request, setRequest] = useState<SubmittedRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const previousStatusRef = useRef<string | null>(null);

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
    toast.success("We'll let you know when this updates.");
  };

  const cancelRequest = async () => {
    if (!requestId || cancelling) return;

    setCancelling(true);

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
      fetchRequest(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel this request."
      );
    } finally {
      setCancelling(false);
    }
  };

  const fetchRequest = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
      }

      setLoadError("");

      if (!requestId) {
        setLoadError("We could not find this request.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/my-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestIds: [requestId] }),
      });

      const result = await response.json();
      const data = result.requests?.[0];

      if (!response.ok || !data) {
        console.log("Confirmation request load error:", result.error);
        setLoadError("We could not load your request.");
        setLoading(false);
        return;
      }

      if (
        previousStatusRef.current !== null &&
        previousStatusRef.current !== data.request_status
      ) {
        const copy = STATUS_COPY[data.request_status];

        if (copy) {
          toast(copy.label, { description: copy.description });

          if (
            getGuestNotificationsEnabled() &&
            document.visibilityState !== "visible"
          ) {
            showBrowserNotification(
              `${data.song_title}: ${copy.label}`,
              copy.description
            );
          }
        }
      }

      previousStatusRef.current = data.request_status;

      setRequest(data);
      setLoadError("");
      setLoading(false);
    },
    [requestId]
  );

  useEffect(() => {
    fetchRequest(true);

    if (!requestId) return;

    /*
     * Polling rather than realtime: the confirmation page has no way to
     * authenticate as "the guest who made this request", so it can't
     * safely use a realtime subscription that depends on unrestricted
     * public read access to song_requests. A few seconds of delay is an
     * acceptable trade for not exposing every guest's request data.
     */
    const interval = setInterval(() => {
      fetchRequest(false);
    }, 4000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchRequest, requestId]);

  const status = request?.request_status || "pending";
  const statusCopy = STATUS_COPY[status] || STATUS_COPY.pending;
  const closedHeader = CLOSED_HEADER[status];
  const tone = requestStatusTone(status);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-5 text-white">
        <Card variant="elevated" className="w-full max-w-xl p-8 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-white/10" />

          <h1 className="mt-5 text-h3">Loading your request...</h1>
        </Card>
      </main>
    );
  }

  if (loadError || !request) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-5 text-white">
        <Card variant="elevated" className="w-full max-w-xl p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-3xl">
            !
          </div>

          <h1 className="mt-5 text-h2">Request not found</h1>

          <p className="mt-3 text-zinc-400">{loadError}</p>

          <Link
            href={`/request/${djSlug}`}
            className={buttonVariants({ className: "mt-7" })}
          >
            Return to request page
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-white sm:px-6 sm:py-14">
      <section className="mx-auto max-w-2xl">
        <div className="text-center">
          {closedHeader ? (
            <>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <X size={32} className="text-zinc-400" strokeWidth={3} />
              </div>

              <Eyebrow className="mt-6">{closedHeader.eyebrow}</Eyebrow>

              <h1 className="mt-3 text-display">{closedHeader.heading}</h1>

              <p className="mx-auto mt-4 max-w-md leading-7 text-zinc-400">
                {closedHeader.description}
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-accent/20 bg-accent/10 shadow-xl shadow-green-500/10">
                <Check size={32} className="text-accent" strokeWidth={3} />
              </div>

              <Eyebrow tone="accent" className="mt-6">
                Request submitted
              </Eyebrow>

              <h1 className="mt-3 text-display">You&apos;re in.</h1>

              <p className="mx-auto mt-4 max-w-md leading-7 text-zinc-400">
                Your payment has been authorised and your request has been
                sent to the DJ.
              </p>
            </>
          )}
        </div>

        <Card variant="elevated" className="mt-10 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>
                {request.request_type === "song_message"
                  ? "Song + Message"
                  : "Song Request"}
              </Eyebrow>

              {request.is_vip && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                  <Crown size={12} /> VIP
                </span>
              )}
            </div>

            <h2 className="mt-3 text-h2">{request.song_title}</h2>

            <p className="mt-2 text-lg text-zinc-400">{request.artist}</p>

            {request.request_type === "song_message" && request.message && (
              <div className="mt-6 rounded-control border border-white/10 bg-black/30 p-5">
                <Eyebrow>Your message</Eyebrow>

                <p className="mt-3 leading-7 text-zinc-200">
                  “{request.message}”
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-white/5 p-6 sm:p-8">
            <div
              className={`rounded-card border p-5 ${toneSurfaceClasses[tone]}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${toneDotClasses[tone]}`}
                />

                <div>
                  <h3 className="text-lg font-bold">{statusCopy.label}</h3>

                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {statusCopy.description}
                  </p>
                </div>
              </div>
            </div>

            {status === "pending" && (
              <button
                type="button"
                onClick={cancelRequest}
                disabled={cancelling}
                className="mt-4 w-full rounded-control border border-red-500/20 bg-red-500/5 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Cancel Request"}
              </button>
            )}

            {status === "accepted" && request.queue_position && (
              <div className="mt-4 flex items-center justify-between rounded-control border border-white/10 bg-white/[0.03] p-5">
                <div>
                  <p className="text-sm text-zinc-500">Queue position</p>

                  <p className="mt-1 text-sm text-zinc-400">
                    Your place in the accepted queue
                  </p>
                </div>

                <p className="text-3xl font-bold">
                  #{request.queue_position}
                </p>
              </div>
            )}

            <div className="mt-4 rounded-control border border-white/10 bg-black/25 p-5">
              <p className="font-semibold">Updates happen automatically</p>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {status === "pending" || status === "checkout_pending"
                  ? "No need to refresh. You’ll only be charged if the DJ accepts your request."
                  : status === "declined" || status === "cancelled"
                    ? "No need to refresh. Your payment will not be captured."
                    : "No need to refresh. Your request status will update here automatically."}
              </p>

              {notifyEnabled ? (
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent">
                  <BellRing size={16} />
                  We&apos;ll notify you when this updates
                </p>
              ) : (
                <button
                  type="button"
                  onClick={enableNotifications}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 underline decoration-zinc-600 underline-offset-4 transition hover:text-white"
                >
                  <Bell size={16} />
                  Notify me when this updates
                </button>
              )}
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/request/${djSlug}/my-requests`}
            className={buttonVariants({ size: "lg" })}
          >
            View My Requests
          </Link>

          <Link
            href={`/request/${djSlug}`}
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Request Another Song
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Secure payment powered by Stripe
        </p>
      </section>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-canvas p-5 text-white">
          <Card variant="elevated" className="w-full max-w-xl p-8 text-center">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-white/10" />
            <h1 className="mt-5 text-h3">Loading your request...</h1>
          </Card>
        </main>
      }
    >
      <ConfirmationPageContent />
    </Suspense>
  );
}
