"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellRing, Flag, ListMusic, WifiOff } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import Button, { buttonVariants } from "@/src/components/ui/Button";
import RequestStatusCard from "@/src/components/request/RequestStatusCard";
import { useRequestStatus } from "@/src/lib/useRequestStatus";
import {
  clearGuestRequestIds,
  getGuestRequestIdsServerSnapshot,
  getGuestRequestIdsSnapshot,
  subscribeGuestRequestIds,
} from "@/src/lib/guestRequestIds";
import {
  requestStatusNotificationCopy,
  canGuestCancel,
  canReportNotPlayed,
  reportActionLabel,
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

/*
 * Grouping order. Live things the guest may still act on come first,
 * finished things last.
 *
 * Requests keep their position within a group, and the group only
 * changes when the backend status changes — so a card never jumps
 * because a poll came back, only because something actually happened
 * to it.
 */
const GROUP_ORDER: Record<string, number> = {
  playing_next: 0,
  accepted: 1,
  pending: 2,
  checkout_pending: 2,
  played: 3,
  declined: 4,
  cancelled: 4,
  expired: 4,
  refunded: 4,
  disputed: 4,
};

export default function MyRequestsPage() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  /* localStorage read through the store rather than copied into state
     on mount, so clearing it re-renders without a second source. */
  const requestIds = useSyncExternalStore(
    subscribeGuestRequestIds,
    () => getGuestRequestIdsSnapshot(djSlug),
    getGuestRequestIdsServerSnapshot
  );

  const { requests, loading, stale, refresh } = useRequestStatus(
    requestIds.length > 0 ? requestIds : null
  );

  const [dj, setDj] = useState<{
    dj_name: string;
    profile_image_url: string | null;
  } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [reportOpenId, setReportOpenId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const notifyEnabled = useSyncExternalStore(
    subscribeGuestNotifications,
    getGuestNotificationsEnabled,
    getGuestNotificationsServerSnapshot
  );

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
   * Announce and notify on real transitions only. The poll runs every
   * four seconds whether anything changed or not.
   */
  const previousStatuses = useRef<Map<string, string> | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (requests.length === 0) return;

    if (previousStatuses.current === null) {
      previousStatuses.current = new Map(
        requests.map((request) => [request.id, request.request_status])
      );
      return;
    }

    const previous = previousStatuses.current;
    const changed: string[] = [];

    requests.forEach((request) => {
      const before = previous.get(request.id);
      previous.set(request.id, request.request_status);

      if (!before || before === request.request_status) return;

      const copy = requestStatusNotificationCopy(request.request_status);
      if (!copy) return;

      changed.push(`${request.song_title}: ${copy}`);
      toast(request.song_title, { description: copy });

      if (
        getGuestNotificationsEnabled() &&
        document.visibilityState !== "visible"
      ) {
        showBrowserNotification(request.song_title, copy);
      }
    });

    if (changed.length > 0) setAnnouncement(changed.join(". "));
  }, [requests]);

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();

    if (!granted) {
      toast.error(
        "Notifications are blocked. Enable them in your browser's site settings."
      );
      return;
    }

    setGuestNotificationsEnabled(true);
    toast.success("We'll alert you while this page stays open.");
  };

  /* Unchanged rule, unchanged server guard: pending only, re-checked in
     the UPDATE. */
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
      setConfirmCancelId(null);
      refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel this request."
      );
    } finally {
      setCancellingId(null);
    }
  };

  const submitReport = async (requestId: string) => {
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
        throw new Error(
          result.error || "Unable to submit your report right now."
        );
      }

      toast.success("Thanks, we've logged this for review.");
      setReportOpenId(null);
      setReportReason("");
      refresh();
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

  const clearHistory = () => {
    clearGuestRequestIds(djSlug);
    setConfirmingClear(false);
    previousStatuses.current = null;
    toast.success("Cleared from this device.");
  };

  const sorted = [...requests].sort(
    (a, b) =>
      (GROUP_ORDER[a.request_status] ?? 9) -
      (GROUP_ORDER[b.request_status] ?? 9)
  );

  const isEmpty = !loading && sorted.length === 0;

  return (
    <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
      <section className="mx-auto max-w-lg">
        <h1 className="sr-only">
          My requests to {dj?.dj_name ?? "this DJ"}
        </h1>

        {/* One region, written only when a status actually changes.
            Queue position moving is deliberately never announced. */}
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </p>

        {/* Same compact identity treatment as 4A and 4C. */}
        <div className="flex items-center gap-3 rounded-card border border-white/10 bg-surface-raised px-3.5 py-3 sm:px-5">
          {dj?.profile_image_url ? (
            <Image
              src={dj.profile_image_url}
              alt=""
              width={36}
              height={36}
              sizes="36px"
              className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-surface-overlay"
            />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {dj?.dj_name ?? "This DJ"}
            </p>
            <p className="text-xs text-zinc-500">
              {sorted.length === 0
                ? "Your requests from this device"
                : `${sorted.length} request${sorted.length === 1 ? "" : "s"} from this device`}
            </p>
          </div>

          <Link
            href={`/request/${djSlug}`}
            aria-label="Request a song"
            title="Request a song"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <ListMusic size={18} aria-hidden />
          </Link>
        </div>

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
              These are the last statuses we had.
            </p>
          </div>
        )}

        {loading && (
          <div className="mt-3 space-y-3" aria-hidden>
            <div className="h-40 animate-pulse rounded-card bg-white/5 motion-reduce:animate-none" />
            <div className="h-40 animate-pulse rounded-card bg-white/5 motion-reduce:animate-none" />
          </div>
        )}

        {isEmpty && (
          <div className="mt-3 rounded-card border border-white/10 bg-surface-raised px-6 py-10 text-center">
            <p className="text-sm font-semibold text-zinc-300">
              No requests yet
            </p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-5 text-zinc-500">
              Requests you send from this device will appear here so you can
              follow what the DJ does with them.
            </p>
            <Link
              href={`/request/${djSlug}`}
              className={buttonVariants({ className: "mt-4" })}
            >
              Request a song
            </Link>
          </div>
        )}

        {sorted.length > 0 && (
          <ul className="mt-3 space-y-3">
            {sorted.map((request) => (
              <li key={request.id}>
                <RequestStatusCard request={request} />

                {canGuestCancel(request.request_status) && (
                  <div className="mt-2">
                    {confirmCancelId === request.id ? (
                      <div className="rounded-card border border-white/10 bg-surface-raised p-3.5">
                        <p className="text-[13px] leading-5 text-zinc-300">
                          Cancel this request? Your authorisation is released
                          and you won&apos;t be charged.
                        </p>

                        <div className="mt-3 flex gap-2.5">
                          <Button
                            variant="secondary"
                            className="h-11 flex-1"
                            onClick={() => setConfirmCancelId(null)}
                            disabled={cancellingId === request.id}
                          >
                            Keep it
                          </Button>
                          <Button
                            variant="danger"
                            className="h-11 flex-1"
                            onClick={() => cancelRequest(request.id)}
                            disabled={cancellingId === request.id}
                            aria-busy={cancellingId === request.id}
                          >
                            {cancellingId === request.id
                              ? "Cancelling..."
                              : "Yes, cancel"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="danger"
                        className="h-11 w-full"
                        onClick={() => setConfirmCancelId(request.id)}
                      >
                        Cancel request
                      </Button>
                    )}
                  </div>
                )}

                {canReportNotPlayed(request.request_status) &&
                  !request.reported_not_played_at && (
                    <div className="mt-2">
                      {reportOpenId === request.id ? (
                        <div className="rounded-card border border-white/10 bg-surface-raised p-3.5">
                          <p className="text-sm font-semibold text-white">
                            {request.request_status === "played"
                              ? "Didn't hear your track?"
                              : "Something not right?"}
                          </p>
                          {/*
                            "Tell us and we'll review it" — not "we'll flag
                            this DJ's account", which was the old wording.
                            The guest is reporting what they did or did not
                            hear; turning that into an accusation against
                            the DJ before anyone has looked is neither fair
                            nor something we can stand behind, since Playing
                            Next cannot hear the room either.
                          */}
                          <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                            Tell us and we&apos;ll review it. Anything you add
                            helps.
                          </p>

                          <div className="mt-3 flex items-baseline justify-between gap-3">
                            <label
                              htmlFor={`report-${request.id}`}
                              className="text-xs font-semibold text-zinc-300"
                            >
                              Details{" "}
                              <span className="font-normal text-zinc-600">
                                (optional)
                              </span>
                            </label>
                            <span className="text-[11px] tabular-nums text-zinc-600">
                              {reportReason.length}/{REPORT_MAX_LENGTH}
                            </span>
                          </div>

                          <textarea
                            id={`report-${request.id}`}
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

                          <div className="mt-3 flex gap-2.5">
                            <Button
                              variant="secondary"
                              className="h-11 flex-1"
                              onClick={() => setReportOpenId(null)}
                              disabled={reportingId === request.id}
                            >
                              Never mind
                            </Button>
                            <Button
                              className="h-11 flex-1"
                              onClick={() => submitReport(request.id)}
                              disabled={reportingId === request.id}
                              aria-busy={reportingId === request.id}
                            >
                              {reportingId === request.id
                                ? "Sending..."
                                : "Send report"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReportOpenId(request.id);
                            setReportReason("");
                          }}
                          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-control border border-white/10 bg-white/[0.03] text-[13px] font-semibold text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                        >
                          <Flag size={13} aria-hidden />
                          {reportActionLabel(request.request_status)}
                        </button>
                      )}
                    </div>
                  )}
              </li>
            ))}
          </ul>
        )}

        {/* ── Page actions ────────────────────────────────────────── */}

        {sorted.length > 0 && (
          <div className="mt-4 space-y-2.5">
            <Link
              href={`/request/${djSlug}`}
              className={buttonVariants({ className: "w-full" })}
            >
              Request another song
            </Link>

            <div className="rounded-card border border-white/5 bg-surface-raised/60 px-3.5 py-1 sm:px-5">
              {notifyEnabled ? (
                <p className="flex min-h-11 items-center gap-2 text-[13px] font-semibold text-accent">
                  <BellRing size={14} aria-hidden />
                  {/*
                    Honest about what this actually is. Guests have no
                    account and no push subscription — src/lib/push.ts is
                    the DJ's, behind authedFetch — so these are local
                    Notifications fired from the polling loop, which only
                    runs while this page is alive. "We'll notify you when
                    any of these update" promised something that never
                    arrives once the tab is closed.
                  */}
                  Alerts on while this page is open
                </p>
              ) : (
                <button
                  type="button"
                  onClick={enableNotifications}
                  className="flex min-h-11 w-full items-center gap-2 rounded text-left text-[13px] text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <Bell size={14} aria-hidden className="shrink-0" />
                  <span>
                    <span className="font-semibold text-zinc-200 underline underline-offset-4">
                      Alert me
                    </span>{" "}
                    while this page is open
                  </span>
                </button>
              )}
            </div>

            {/*
              Low emphasis and it asks first. Clearing removes the only
              link between this device and these requests, and there is no
              account to recover them from — so it is irreversible from
              the guest's side even though nothing is deleted at our end.
            */}
            {confirmingClear ? (
              <div className="rounded-card border border-white/10 bg-surface-raised p-3.5 sm:p-5">
                <p className="text-[13px] leading-5 text-zinc-300">
                  Remove these requests from this device? They stay in the
                  DJ&apos;s records and any payment is unaffected, but this
                  device won&apos;t be able to show them again.
                </p>

                <div className="mt-3 flex gap-2.5">
                  <Button
                    variant="secondary"
                    className="h-11 flex-1"
                    onClick={() => setConfirmingClear(false)}
                  >
                    Keep them
                  </Button>
                  <Button
                    variant="danger"
                    className="h-11 flex-1"
                    onClick={clearHistory}
                  >
                    Yes, remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="danger"
                className="h-11 w-full"
                onClick={() => setConfirmingClear(true)}
              >
                Remove from this device
              </Button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
