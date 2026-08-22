"use client";

import Link from "next/link";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellRing, Flag, WifiOff } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import Button, { buttonVariants } from "@/src/components/ui/Button";
import RequestStatusCard from "@/src/components/request/RequestStatusCard";
import { useRequestStatus } from "@/src/lib/useRequestStatus";
import {
  requestStatusLabel,
  requestStatusDescription,
  requestStatusNotificationCopy,
  canGuestCancel,
  canReportNotPlayed,
  isClosedStatus,
} from "@/src/lib/requestStatus";
import {
  getGuestNotificationsEnabled,
  getGuestNotificationsServerSnapshot,
  requestNotificationPermission,
  setGuestNotificationsEnabled,
  showBrowserNotification,
  subscribeGuestNotifications,
} from "@/src/lib/notifications";

const REPORT_MAX_LENGTH = 500;

function ConfirmationPageContent() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");

  /*
   * Polling, its failure handling and its cleanup all live in
   * useRequestStatus now. The page previously did this inline and set a
   * page-level error on any failed poll, so a single blip on venue wifi
   * replaced a request the guest had just paid for with an error screen.
   */
  const { request, loading, fatalError, stale, refresh } = useRequestStatus(
    requestId ? [requestId] : null
  );

  const [dj, setDj] = useState<{
    dj_name: string;
    profile_image_url: string | null;
  } | null>(null);
  /* Read through the store rather than copied into state on mount. */
  const notifyEnabled = useSyncExternalStore(
    subscribeGuestNotifications,
    getGuestNotificationsEnabled,
    getGuestNotificationsServerSnapshot
  );
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);

  const status = request?.request_status ?? "pending";

  /*
   * Identity is a separate public read: /api/my-requests deliberately
   * returns an explicit field list with no DJ and no financial data,
   * which is the right call for an unauthenticated lookup-by-id and not
   * something to widen for a name and an avatar.
   */
  useEffect(() => {
    let cancelled = false;

    supabase
      .from("dj_profiles")
      .select("dj_name, profile_image_url")
      .eq("slug", djSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setDj(data);
      });

    return () => {
      cancelled = true;
    };
  }, [djSlug]);

  /*
   * Announcements and notifications fire on a real transition only. The
   * poll runs every four seconds whether anything changed or not, and a
   * live region that re-announces the same status every four seconds is
   * unusable with a screen reader.
   */
  const previousStatusRef = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!request) return;

    const previous = previousStatusRef.current;
    previousStatusRef.current = request.request_status;

    if (previous === null || previous === request.request_status) return;

    const label = requestStatusLabel(request.request_status, "guest");
    setAnnouncement(
      `${request.song_title}: ${label}. ${requestStatusDescription(
        request.request_status
      )}`
    );

    const copy = requestStatusNotificationCopy(request.request_status);

    if (copy) {
      toast(request.song_title, { description: copy });

      if (
        getGuestNotificationsEnabled() &&
        document.visibilityState !== "visible"
      ) {
        showBrowserNotification(request.song_title, copy);
      }
    }
  }, [request]);

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();

    if (!granted) {
      toast.error(
        "Notifications are blocked. Enable them in your browser's site settings."
      );
      return;
    }

    setGuestNotificationsEnabled(true);
    toast.success("We'll let you know when this updates.");
  };

  /* Unchanged: pending-only, and the server re-checks it in the UPDATE. */
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
      setConfirmingCancel(false);
      refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel this request."
      );
    } finally {
      setCancelling(false);
    }
  };

  const submitNotPlayedReport = async () => {
    if (!requestId || reporting) return;

    setReporting(true);

    try {
      const response = await fetch("/api/request/report-not-played", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, reason: reportReason }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to submit your report right now."
        );
      }

      toast.success("Thanks, we've logged this for review.");
      setReportOpen(false);
      setReportReason("");
      refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to submit your report right now."
      );
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
        <div className="mx-auto max-w-lg">
          <div className="h-14 animate-pulse rounded-card bg-white/5 motion-reduce:animate-none" />
          <div className="mt-4 h-52 animate-pulse rounded-card bg-white/5 motion-reduce:animate-none" />
          <p className="sr-only" role="status">
            Loading your request
          </p>
        </div>
      </main>
    );
  }

  if (fatalError || !request) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4 text-white">
        <div className="w-full max-w-sm rounded-card border border-white/10 bg-surface-raised p-6 text-center">
          <h1 className="text-lg font-bold">
            {fatalError || "We couldn't find this request."}
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-zinc-500">
            The link may be incomplete. Your requests from this device are
            listed on My Requests.
          </p>
          <Link
            href={`/request/${djSlug}/my-requests`}
            className={buttonVariants({ className: "mt-5 w-full" })}
          >
            See my requests
          </Link>
        </div>
      </main>
    );
  }

  const closed = isClosedStatus(status);

  /*
   * Whether anything is still expected to happen. "Played" is not in
   * isClosedStatus — a played request can still become refunded or
   * disputed — but from the guest's point of view it is finished, and
   * telling someone their completed request "updates on its own" is
   * noise on what should read as a clean end state.
   */
  const awaitingUpdate = !closed && status !== "played";

  return (
    <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
      <section className="mx-auto max-w-lg">
        <h1 className="sr-only">
          Your request to {dj?.dj_name ?? "the DJ"}
        </h1>

        {/*
          One polite live region for the whole page, written only when
          the backend status actually changes. Queue position moving is
          deliberately not announced: it shifts whenever anyone else's
          request is played, and narrating that every few seconds would
          bury the changes that matter.
        */}
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </p>

        {/* Identity, compact and secondary. This page is about the
            request; the DJ is context for it. */}
        <div className="flex items-center gap-3 rounded-card border border-white/10 bg-surface-raised px-3.5 py-3 sm:px-5">
          {dj?.profile_image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element -- Supabase
               storage URL at 36px; nothing for next/image to optimize. */
            <img
              src={dj.profile_image_url}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-surface-overlay"
            />
          )}

          {/* Not "Your request to X" again — the h1 already says that,
              and repeating it verbatim made a screen reader announce the
              same sentence twice before reaching the status. */}
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            {dj?.dj_name ?? "the DJ"}
          </p>
        </div>

        {/*
          Sustained polling trouble, shown beside the last known status
          rather than instead of it. Three consecutive failures, roughly
          twelve seconds; a single dropped poll is invisible.
        */}
        {stale && (
          <div
            role="status"
            className="mt-3 flex items-start gap-2.5 rounded-card border border-status-pending-surface/25 bg-status-pending-surface/[0.07] px-3.5 py-3"
          >
            <WifiOff
              size={15}
              aria-hidden
              className="mt-0.5 shrink-0 text-status-pending"
            />
            <p className="text-[13px] leading-5 text-zinc-300">
              <span className="font-semibold text-status-pending">
                Not updating right now.
              </span>{" "}
              This is the last status we had. We&apos;ll keep trying.
            </p>
          </div>
        )}

        <div className="mt-3">
          <RequestStatusCard request={request} feature />
        </div>

        {/* ── Actions, only the ones that apply ───────────────────── */}

        {canGuestCancel(status) && (
          <div className="mt-3">
            {confirmingCancel ? (
              <div className="rounded-card border border-white/10 bg-surface-raised p-3.5 sm:p-5">
                <p className="text-sm text-zinc-300">
                  Cancel this request? Your authorisation is released and you
                  won&apos;t be charged.
                </p>

                <div className="mt-3 flex flex-wrap gap-2.5">
                  <Button
                    variant="secondary"
                    className="h-11 flex-1"
                    onClick={() => setConfirmingCancel(false)}
                    disabled={cancelling}
                  >
                    Keep it
                  </Button>

                  <Button
                    variant="danger"
                    className="h-11 flex-1"
                    onClick={cancelRequest}
                    disabled={cancelling}
                    aria-busy={cancelling}
                  >
                    {cancelling ? "Cancelling..." : "Yes, cancel"}
                  </Button>
                </div>
              </div>
            ) : (
              /* danger, not primary: cancelling is the one thing here the
                 guest cannot undo. */
              <Button
                variant="danger"
                className="h-11 w-full"
                onClick={() => setConfirmingCancel(true)}
              >
                Cancel request
              </Button>
            )}
          </div>
        )}

        {canReportNotPlayed(status) && !request.reported_not_played_at && (
          <div className="mt-3">
            {reportOpen ? (
              <div className="rounded-card border border-white/10 bg-surface-raised p-3.5 sm:p-5">
                <p className="text-sm font-semibold text-white">
                  Didn&apos;t hear this one?
                </p>
                <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                  We&apos;ll pass this to our team to look into. Add anything
                  that might help.
                </p>

                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="report-reason"
                    className="text-xs font-semibold text-zinc-300"
                  >
                    Details{" "}
                    <span className="font-normal text-zinc-600">(optional)</span>
                  </label>
                  <span className="text-[11px] tabular-nums text-zinc-600">
                    {reportReason.length}/{REPORT_MAX_LENGTH}
                  </span>
                </div>

                <textarea
                  id="report-reason"
                  value={reportReason}
                  onChange={(event) =>
                    setReportReason(
                      event.target.value.slice(0, REPORT_MAX_LENGTH)
                    )
                  }
                  maxLength={REPORT_MAX_LENGTH}
                  rows={2}
                  placeholder="I stayed until the end and didn't hear it."
                  className="mt-1.5 w-full rounded-control border border-white/10 bg-surface-base px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
                />

                <div className="mt-3 flex flex-wrap gap-2.5">
                  <Button
                    variant="secondary"
                    className="h-11 flex-1"
                    onClick={() => setReportOpen(false)}
                    disabled={reporting}
                  >
                    Never mind
                  </Button>

                  <Button
                    className="h-11 flex-1"
                    onClick={submitNotPlayedReport}
                    disabled={reporting}
                    aria-busy={reporting}
                  >
                    {reporting ? "Sending..." : "Send report"}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-control border border-white/10 bg-white/[0.03] text-[13px] font-semibold text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <Flag size={13} aria-hidden />
                I didn&apos;t hear this track
              </button>
            )}
          </div>
        )}

        {/* Live updates note, only while there is still something to
            wait for. A finished request has nothing to announce. */}
        {awaitingUpdate && (
          <div className="mt-3 rounded-card border border-white/5 bg-surface-raised/60 px-3.5 py-3 sm:px-5">
            {notifyEnabled ? (
              <p className="flex items-center gap-2 text-[13px] font-semibold text-accent">
                <BellRing size={14} aria-hidden />
                We&apos;ll let you know when this updates
              </p>
            ) : (
              <button
                type="button"
                onClick={enableNotifications}
                className="flex min-h-11 w-full items-center gap-2 rounded text-left text-[13px] text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <Bell size={14} aria-hidden className="shrink-0" />
                <span>
                  This updates on its own.{" "}
                  <span className="font-semibold text-zinc-200 underline underline-offset-4">
                    Notify me
                  </span>{" "}
                  when it changes.
                </span>
              </button>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <Link
            href={`/request/${djSlug}/my-requests`}
            className={buttonVariants({ variant: "secondary" })}
          >
            See all my requests
          </Link>

          <Link
            href={`/request/${djSlug}`}
            className={buttonVariants({
              variant: closed || status === "played" ? "primary" : "secondary",
            })}
          >
            Request another song
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
          <div className="mx-auto max-w-lg">
            <div className="h-14 animate-pulse rounded-card bg-white/5 motion-reduce:animate-none" />
            <div className="mt-4 h-52 animate-pulse rounded-card bg-white/5 motion-reduce:animate-none" />
          </div>
        </main>
      }
    >
      <ConfirmationPageContent />
    </Suspense>
  );
}
