"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "../../../src/lib/supabase";
import { availabilityState } from "@/src/lib/guestAvailability";
import {
  addGuestRequestId,
  readGuestRequestIds,
} from "@/src/lib/guestRequestIds";
import {
  getGuestNotificationsEnabled,
  showBrowserNotification,
} from "@/src/lib/notifications";
import { requestStatusNotificationCopy } from "@/src/lib/requestStatus";
import RequestHeader, {
  type DJProfile,
} from "@/src/components/request/RequestHeader";

import SpotifySearchInput from "@/src/components/request/SpotifySearchInput";
import TrackResults, {
  type SpotifyTrack,
} from "@/src/components/request/TrackResults";
import SelectedSong from "@/src/components/request/SelectedSong";
import RequestOptions from "@/src/components/request/RequestOptions";
import CheckoutButton from "@/src/components/request/CheckoutButton";
import TipCard from "@/src/components/request/TipCard";
import {
  SearchIdle,
  SearchLoading,
  SearchNoResults,
  SearchError,
} from "@/src/components/request/SearchStates";
import UnavailableNotice from "@/src/components/request/UnavailableNotice";
import Card from "@/src/components/ui/Card";
import { buttonVariants } from "@/src/components/ui/Button";


export default function RequestPage() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  const [djProfile, setDjProfile] = useState<DJProfile | null>(null);
  const [isLoadingDJ, setIsLoadingDJ] = useState(true);
  const [djNotFound, setDjNotFound] = useState(false);
  const [activeEvent, setActiveEvent] = useState<{
    id: string;
    name: string;
    request_price: number | null;
    shoutout_price: number | null;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  /*
   * The finished result, tagged with the query that produced it.
   *
   * The phase below is derived from this rather than stored, for two
   * reasons. Storing it meant writing state synchronously inside the
   * search effect on every keystroke, which is a cascading render. It
   * also let a stale result show against a newer query: results for
   * "riha" stayed on screen, labelled as results, while "rihanna" was
   * still in flight. Keying the result to its own query makes "is this
   * answer about what I typed?" a comparison rather than a race.
   */
  const [searchResult, setSearchResult] = useState<{
    query: string;
    status: "results" | "empty" | "error";
  } | null>(null);
  const [searchNonce, setSearchNonce] = useState(0);
  const [selectedSong, setSelectedSong] = useState<SpotifyTrack | null>(null);
  /*
   * Tagged with the track it describes, for the same reason as the
   * search result: clearing it in an effect was a synchronous setState,
   * and an untagged warning could briefly describe the previous song
   * after the guest changed their mind.
   */
  const [duplicateResult, setDuplicateResult] = useState<{
    trackId: string;
    alreadyRequested: boolean;
    alreadyPlayed: boolean;
  } | null>(null);

  const [requestType, setRequestType] = useState<
    "song_request" | "song_message"
  >("song_request");

  const [message, setMessage] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [vipAvailable, setVipAvailable] = useState(true);
  const [pendingFull, setPendingFull] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const previousRequestStatusesRef = useRef<Map<string, string> | null>(
    null
  );

  const searchAbortControllerRef = useRef<AbortController | null>(null);


  /*
   * Reads the query string directly rather than useSearchParams, which
   * would require wrapping this whole page in a Suspense boundary just
   * for a one-off toast on the way back from a tip. Cleans the URL
   * afterwards so refreshing the page doesn't re-fire the toast.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("tipped") === "1") {
      const amount = params.get("tipAmount");

      toast.success(
        amount ? `Thanks for the £${amount} tip! 🎉` : "Thanks for the tip! 🎉"
      );

      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  /*
   * Informational only — lets a guest know before they pay that a
   * track is already in the queue or was already played tonight.
   */
  const duplicateWarning =
    selectedSong && duplicateResult?.trackId === selectedSong.id
      ? duplicateResult
      : null;

  useEffect(() => {
    if (!selectedSong) return;

    let cancelled = false;

    const checkDuplicate = async () => {
      try {
        const response = await fetch(
          `/api/request/duplicate-check?djSlug=${encodeURIComponent(djSlug)}&spotifyTrackId=${encodeURIComponent(selectedSong.id)}`
        );

        if (!response.ok || cancelled) return;

        const data = await response.json();
        if (!cancelled) {
          setDuplicateResult({ trackId: selectedSong.id, ...data });
        }
      } catch (error) {
        console.log("Duplicate check error:", error);
      }
    };

    checkDuplicate();

    return () => {
      cancelled = true;
    };
  }, [selectedSong, djSlug]);

  /*
   * Debounced rather than firing on every keystroke — searching "levels"
   * used to mean 6 separate Spotify calls instead of 1. 300ms is short
   * enough to still feel instant, long enough to skip past mid-word
   * keystrokes for anyone typing at a normal pace.
   */
  const trimmedQuery = searchQuery.trim();

  /*
   * Anything without a matching finished result is still loading — which
   * covers the 300ms debounce as well as the network wait. That gap was
   * part of the blank period the guest used to stare at.
   */
  const searchPhase: "idle" | "loading" | "results" | "empty" | "error" =
    trimmedQuery.length < 2
      ? "idle"
      : searchResult?.query === trimmedQuery
        ? searchResult.status
        : "loading";

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      searchAbortControllerRef.current?.abort();
      return;
    }

    const timeout = setTimeout(async () => {
      searchAbortControllerRef.current?.abort();
      const controller = new AbortController();
      searchAbortControllerRef.current = controller;

      try {
        const response = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }

        const data = await response.json();
        setTracks(data);
        setSearchResult({
          query: trimmedQuery,
          status: data.length > 0 ? "results" : "empty",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.log("Spotify search error:", error);
        setTracks([]);
        /*
         * Shown in place now rather than only as a toast. A toast that
         * has already faded leaves the guest staring at an empty panel
         * with no idea what happened or how to retry.
         */
        setSearchResult({ query: trimmedQuery, status: "error" });
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [trimmedQuery, searchNonce]);

  useEffect(() => {
    let isMounted = true;

    /*
     * ── What this page polls, and why so little of it ────────────────
     *
     * Measured before this: 36 requests a minute while a guest sat doing
     * nothing — dj_profiles, dj_events and vip-status each every five
     * seconds, plus a realtime subscription already watching dj_profiles
     * for the same changes. In a venue on shared mobile data that is a
     * lot of chatter for a page that mostly does not change.
     *
     * Now:
     *   dj_profiles   realtime subscription, plus a slow safety net
     *   dj_events     folded into the profile query, no separate call
     *   vip-status    every 15s, the only thing genuinely worth polling
     *
     * Nothing here carries request status. That stays on its own 4s poll
     * (useRequestStatus) because it is the thing a guest is actually
     * waiting on.
     */
    const PROFILE_SAFETY_NET_MS = 60_000;
    const VIP_POLL_MS = 15_000;

    /*
     * The active event is embedded in the profile read rather than
     * fetched separately. It is filtered server-side AND re-checked
     * here: this row decides the price the guest is charged, so an
     * inactive event slipping through would be a pricing bug, and one
     * belt is not enough for that.
     */
    const PROFILE_SELECT =
      "id, dj_name, request_status, last_active_at, auto_close_at, genres, bio, " +
      "request_price, shoutout_price, profile_image_url, " +
      "dj_events(id, name, request_price, shoutout_price, is_active)";

    type EmbeddedEvent = {
      id: string;
      name: string;
      request_price: number | null;
      shoutout_price: number | null;
      is_active?: boolean | null;
    };

    const readProfile = async () => {
      const { data, error } = await supabase
        .from("dj_profiles")
        .select(PROFILE_SELECT)
        .eq("slug", djSlug)
        .eq("dj_events.is_active", true)
        .maybeSingle();

      if (error || !data) return { profile: null, event: null };

      /* `unknown` first: the generated types model an embedded select
         as a possible error shape, which does not overlap the row. */
      const row = data as unknown as Record<string, unknown> & {
        dj_events?: EmbeddedEvent[] | null;
      };
      const events = row.dj_events;
      const profile = { ...row };
      delete profile.dj_events;

      const event =
        (events ?? []).find((candidate) => candidate.is_active !== false) ??
        null;

      return { profile, event };
    };

    const applyProfile = (
      profile: Record<string, unknown> | null,
      event: EmbeddedEvent | null
    ) => {
      if (!isMounted || !profile) return;

      /*
       * Deliberately does not clear the guest's work. This used to reset
       * searchQuery, selectedSong, message, requestType and isVip
       * whenever the DJ stopped taking requests — on a five second timer.
       * A DJ pausing briefly threw away everything the guest had entered.
       */
      setDjProfile(profile as unknown as DJProfile);
      setActiveEvent(event);
    };

    const loadDJ = async () => {
      setIsLoadingDJ(true);

      const { profile, event } = await readProfile();

      if (!isMounted) return;

      if (!profile) {
        setDjNotFound(true);
        setIsLoadingDJ(false);
        return;
      }

      applyProfile(profile, event);
      setDjNotFound(false);
      setIsLoadingDJ(false);
    };

    const refreshDJ = async () => {
      const { profile, event } = await readProfile();
      applyProfile(profile, event);
    };

    const fetchVipStatus = async () => {
      try {
        const response = await fetch(`/api/vip-status/${djSlug}`);
        const data = await response.json();

        if (!isMounted || !response.ok) return;

        setVipAvailable(data.vipAvailable !== false);
        setPendingFull(data.pendingFull === true);
      } catch (error) {
        /* A failed VIP check leaves the last known answer in place rather
           than guessing; the server re-checks both caps at create time. */
        console.log("VIP status fetch error:", error);
      }
    };

    loadDJ();
    fetchVipStatus();

    /*
     * Timers only run while the page is actually being looked at. A
     * phone in a pocket does not need to know the DJ's status, and a
     * backgrounded tab polling on venue data is pure battery cost.
     */
    let vipTimer: ReturnType<typeof setInterval> | undefined;
    let profileTimer: ReturnType<typeof setInterval> | undefined;

    const startTimers = () => {
      if (vipTimer || profileTimer) return;
      vipTimer = setInterval(fetchVipStatus, VIP_POLL_MS);
      /* Safety net only: realtime below is the primary path, but it can
         drop silently and a stale "paused" badge would be worse than one
         request a minute. */
      profileTimer = setInterval(refreshDJ, PROFILE_SAFETY_NET_MS);
    };

    const stopTimers = () => {
      clearInterval(vipTimer);
      clearInterval(profileTimer);
      vipTimer = undefined;
      profileTimer = undefined;
    };

    if (document.visibilityState === "visible") startTimers();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        /* Coming back is exactly when the guest most wants the truth, so
           fetch immediately rather than waiting for the next tick. */
        refreshDJ();
        fetchVipStatus();
        startTimers();
      } else {
        stopTimers();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const channel = supabase
      .channel(`request_page_${djSlug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dj_profiles",
          filter: `slug=eq.${djSlug}`,
        },
        () => refreshDJ()
      )
      .subscribe();

    return () => {
      isMounted = false;
      stopTimers();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [djSlug]);

  /*
   * A guest browsing here for a second song still has an earlier
   * request out for a decision — without this, the request page is the
   * one place in the guest flow with zero visibility into it. Reuses
   * the same localStorage-tracked IDs as the confirmation/My Requests
   * pages; the notification toggle itself is a single global
   * preference, so nothing new to opt into here.
   */
  useEffect(() => {
    const checkMyRequests = async () => {
      const myRequestIds = readGuestRequestIds(djSlug);

      if (myRequestIds.length === 0) return;

      const response = await fetch("/api/my-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestIds: myRequestIds }),
      });

      if (!response.ok) return;

      const result = await response.json();
      const freshRequests: { id: string; song_title: string; request_status: string }[] =
        result.requests || [];

      if (previousRequestStatusesRef.current === null) {
        previousRequestStatusesRef.current = new Map(
          freshRequests.map((request) => [request.id, request.request_status])
        );
        return;
      }

      const previous = previousRequestStatusesRef.current;

      freshRequests.forEach((request) => {
        const previousStatus = previous.get(request.id);

        if (previousStatus && previousStatus !== request.request_status) {
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
        }

        previous.set(request.id, request.request_status);
      });
    };

    checkMyRequests();

    const interval = setInterval(checkMyRequests, 4000);

    return () => clearInterval(interval);
  }, [djSlug]);

  /*
   * One object describing whether the guest can request and why not,
   * rather than two booleans the UI had to interpret. The four reasons
   * stay distinct so the notice can say something useful; see
   * guestAvailability.ts for why none of that copy mentions the DJ's
   * activity.
   */
  const availability = availabilityState(djProfile, pendingFull);
  const canRequest = availability.canRequest;

  /* Tips are not gated by the pending cap: they add nothing to the
     pending list. They do still require the DJ to be around. */
  const isTakingRequests = availability.reason !== "pending_full"
    ? canRequest
    : true;

  const requestPrice =
    activeEvent?.request_price ?? djProfile?.request_price ?? 500;
  const shoutoutPrice =
    activeEvent?.shoutout_price ?? djProfile?.shoutout_price ?? 800;

  const submitRequest = async () => {
    if (!selectedSong || !djProfile || !canRequest || submitting) return;

    if (requestType === "song_message" && message.trim().length === 0) {
      toast.error("Please add a message for your Song + Message request.");
      return;
    }

    /*
     * No client-side profanity check on purpose. /api/request/create
     * runs before the Stripe redirect and surfaces its rejection as a
     * toast, so the guest is already told to reword before any payment
     * — mirroring the matcher here would only save a round-trip, and
     * it costs ~20KB gzipped on every guest's phone to do it.
     */

    setSubmitting(true);

    try {
      await createAndCheckout();
    } finally {
      setSubmitting(false);
    }
  };

  const createAndCheckout = async () => {
    if (!selectedSong) return;

    const createResponse = await fetch("/api/request/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        djSlug,
        songTitle: selectedSong.title,
        artist: selectedSong.artist,
        spotifyTrackId: selectedSong.id,
        requestType,
        message: requestType === "song_message" ? message.trim() : undefined,
        isVip,
      }),
    });

    const createData = await createResponse.json();

    if (!createResponse.ok || !createData.requestId) {
      console.log("Request create error:", createData.error);
      toast.error(
        createData.error || "Something went wrong creating your request."
      );
      return;
    }

    const requestId = createData.requestId as string;

    /* Through the shared helper so every read and write of the guest's
       ownership record is guarded the same way. */
    addGuestRequestId(djSlug, requestId);

    const checkoutResponse = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        songTitle: selectedSong.title,
        artist: selectedSong.artist,
        requestId,
        djSlug,
        requestType,
        requestPrice:
          requestType === "song_message"
            ? shoutoutPrice
            : requestPrice,
      }),
    });

    const checkoutData = await checkoutResponse.json();

    if (!checkoutResponse.ok || !checkoutData.url) {
      console.log("Checkout create error:", checkoutData.error);
      toast.error(
        checkoutData.error || "Something went wrong starting checkout."
      );
      return;
    }

    window.location.href = checkoutData.url;
  };

  if (isLoadingDJ) {
    return (
      <main className="min-h-screen bg-canvas p-6 text-white">
        <section className="mx-auto flex min-h-screen max-w-xl items-center justify-center">
          <Card variant="elevated" className="p-8 text-center">
            <p className="text-sm text-zinc-400">Playing Next</p>
            <h1 className="mt-3 text-h2">Loading DJ...</h1>
          </Card>
        </section>
      </main>
    );
  }

  if (djNotFound) {
    return (
      <main className="min-h-screen bg-canvas p-6 text-white">
        <section className="mx-auto flex min-h-screen max-w-xl items-center justify-center">
          <Card variant="elevated" className="p-8 text-center">
            <h1 className="text-h1">DJ Not Found</h1>

            <p className="mt-4 text-zinc-400">
              This request link is invalid or no longer active.
            </p>

            <Link
              href="/"
              className={buttonVariants({ className: "mt-6" })}
            >
              Go to Playing Next
            </Link>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas text-white">
      {/*
        Composition order is the guest's job order: identity, then
        whether they can request, then search. The tip card used to sit
        above the search panel, which asked someone to tip before they
        had even found a song.
      */}
      <section className="mx-auto max-w-2xl px-4 py-4 sm:px-6 sm:py-8">
        <RequestHeader
          djSlug={djSlug}
          djProfile={djProfile!}
          availability={availability}
          eventName={activeEvent?.name ?? null}
        />

        {!canRequest && (
          <div className="mt-4">
            <UnavailableNotice availability={availability} />
          </div>
        )}

        {/*
          One panel for the whole find-a-song step, rather than the four
          stacked elevated Cards this used to be. The guest is doing one
          thing here.
        */}
        {/*
          The selected card carries its own accent border, so it is not
          wrapped in the neutral panel — nesting the two produced a
          double outline around the same content.
        */}
        <div
          className={
            selectedSong
              ? "mt-4"
              : "mt-4 rounded-card border border-white/10 bg-surface-raised p-3.5 sm:p-5"
          }
        >
          {selectedSong ? (
            <SelectedSong
              selectedSong={selectedSong}
              duplicateWarning={duplicateWarning}
              onChangeSong={() => {
                /*
                 * Only the song is cleared. Message, request type and
                 * VIP are choices about the request, not about this
                 * track, so swapping song keeps them.
                 */
                setSelectedSong(null);
                setSearchQuery("");
                setTracks([]);
                setSearchResult(null);
              }}
            />
          ) : (
            <>
              <h2 className="text-base font-bold tracking-tight sm:text-lg">
                What should the DJ play?
              </h2>

              <div className="mt-3">
                <SpotifySearchInput
                  searchQuery={searchQuery}
                  canRequest={canRequest}
                  onSearch={setSearchQuery}
                />
              </div>

              {canRequest && (
                <div className="mt-3">
                  {searchPhase === "idle" && <SearchIdle />}
                  {searchPhase === "loading" && <SearchLoading />}
                  {searchPhase === "empty" && (
                    <SearchNoResults
                      query={searchQuery}
                      onClear={() => setSearchQuery("")}
                    />
                  )}
                  {searchPhase === "error" && (
                    <SearchError
                      onRetry={() => {
                        /* Clearing the result puts the panel back into
                           loading while the retry runs. */
                        setSearchResult(null);
                        setSearchNonce((n) => n + 1);
                      }}
                    />
                  )}
                  {searchPhase === "results" && (
                    <TrackResults
                      tracks={tracks}
                      canRequest={canRequest}
                      onSelect={setSelectedSong}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/*
          One group, not three boxes.
          The song is its own accent card because it is the subject the
          guest chose; everything after it — what kind of request, VIP,
          the message, the price and the button — is a single decision
          and lives in one container with internal dividers. Splitting
          those into separate bordered cards made a two-question step
          read as a five-part form.
        */}
        {selectedSong && (
          <>
            <div className="mt-4 overflow-hidden rounded-card border border-white/10 bg-surface-raised">
              <div className="p-3.5 sm:p-5">
              <RequestOptions
                requestType={requestType}
                setRequestType={setRequestType}
                requestPrice={requestPrice}
                shoutoutPrice={shoutoutPrice}
                message={message}
                setMessage={setMessage}
                isTakingRequests={canRequest}
                isVip={isVip}
                setIsVip={setIsVip}
                vipAvailable={vipAvailable}
              />
              </div>

              <div className="border-t border-white/10 bg-surface-base/30 p-3.5 sm:p-5">
                <CheckoutButton
                  flush
                  selectedSong
                  isTakingRequests={canRequest}
                  requestType={requestType}
                  requestPrice={requestPrice}
                  shoutoutPrice={shoutoutPrice}
                  isVip={isVip}
                  submitting={submitting}
                  onCheckout={submitRequest}
                />
              </div>
            </div>
          </>
        )}

        <div className="mt-4">
          <TipCard djSlug={djSlug} isTakingRequests={isTakingRequests} />
        </div>
      </section>
    </main>
  );
}
