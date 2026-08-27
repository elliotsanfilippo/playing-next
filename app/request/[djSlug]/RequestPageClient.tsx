"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { availabilityState } from "@/src/lib/guestAvailability";
import {
  addGuestRequestId,
  getGuestRequestIdsServerSnapshot,
  getGuestRequestIdsSnapshot,
  subscribeGuestRequestIds,
} from "@/src/lib/guestRequestIds";
import { useRequestStatus } from "@/src/lib/useRequestStatus";
import {
  getGuestNotificationsEnabled,
  showBrowserNotification,
} from "@/src/lib/notifications";
import { requestStatusNotificationCopy } from "@/src/lib/requestStatus";
import RequestHeader, {
  type DJProfile,
} from "@/src/components/request/RequestHeader";

import SpotifySearchInput from "@/src/components/request/SpotifySearchInput";
import type { SpotifyTrack } from "@/src/components/request/TrackResults";

/*
 * ── Why these five are loaded on demand ───────────────────────────
 *
 * Between them they pull in Motion (~48KB on the wire) and, through
 * TipCard, the obscenity matcher. None of it is needed to show a guest
 * the DJ, the availability, or a search box they can type into — which
 * is the only thing that matters while they are standing in a venue
 * waiting for the page to become useful.
 *
 * Measured before this work: 385KB of critical JS and 5.9s to a first
 * accepted keystroke at 700kbps.
 *
 * ssr:false on these four, and it costs nothing visually: every one of
 * them is rendered behind a condition that is false on arrival — there
 * are no results until the guest searches and no selection until they
 * pick a track — so they contribute no markup to the first paint either
 * way. Leaving ssr on kept their chunk in the hydration graph, which
 * measured as Motion still loading in the initial batch and bought the
 * guest nothing.
 */
const TrackResults = dynamic(
  () => import("@/src/components/request/TrackResults"),
  { ssr: false }
);
const SelectedSong = dynamic(
  () => import("@/src/components/request/SelectedSong"),
  { ssr: false }
);
const RequestOptions = dynamic(
  () => import("@/src/components/request/RequestOptions"),
  { ssr: false }
);
const CheckoutButton = dynamic(
  () => import("@/src/components/request/CheckoutButton"),
  { ssr: false }
);

/*
 * TipCard is the last thing holding Motion on the critical path, and it
 * is on screen at load — measured at exactly 62px tall in its collapsed
 * state at 360, 390 and 768 wide, so its height does not depend on the
 * viewport.
 *
 * That fixed height is what makes deferring it safe. The wrapper below
 * reserves 62px in the server HTML, so the space the card will occupy is
 * already held open before its JavaScript exists. The card fades into a
 * gap that was always there rather than pushing the page down when it
 * arrives, and CLS stays at zero.
 *
 * The card itself is untouched — same copy, same amounts, same
 * moderation, same Stripe call, same event linkage. Only the moment its
 * code downloads has changed.
 */
const TipCard = dynamic(() => import("@/src/components/request/TipCard"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[62px]" />,
});
import {
  SearchIdle,
  SearchLoading,
  SearchNoResults,
  SearchError,
} from "@/src/components/request/SearchStates";
import UnavailableNotice from "@/src/components/request/UnavailableNotice";
import Card from "@/src/components/ui/Card";
import { buttonVariants } from "@/src/components/ui/Button";

/*
 * ── Why the Supabase client is not imported at module scope ───────
 *
 * The browser client is ~58KB on the wire — auth-js, postgrest-js,
 * realtime-js, storage-js and phoenix — and it is the single largest
 * third-party cost on this page. None of it is needed to paint the DJ
 * or to accept the guest's first keystroke: R6 moved the initial DJ data
 * to a server render, so by the time this page hydrates the guest is
 * already looking at the right name, availability and prices.
 *
 * What the client is still for is everything that happens AFTER that —
 * the realtime subscription, the 60s reconciliation safety net, and
 * re-reading pricing when the submit path says the event changed. All of
 * it can wait for the browser to be idle, and none of it is worth making
 * a guest in a venue wait 0.66s longer to type.
 *
 * The promise is memoised so the reconciliation, the realtime channel
 * and the submit path all share one client and one download.
 */
type BrowserSupabase = Awaited<
  typeof import("../../../src/lib/supabase")
>["supabase"];

let supabaseClientPromise: Promise<BrowserSupabase> | null = null;

const getSupabase = (): Promise<BrowserSupabase> => {
  supabaseClientPromise ??= import("../../../src/lib/supabase").then(
    (m) => m.supabase
  );
  return supabaseClientPromise;
};

/* Loads in whatever gap the browser has spare, with a backstop so a
   device that never goes idle still reconciles promptly. Safari has no
   requestIdleCallback, hence the fallback. */
const whenIdle = (run: () => void): (() => void) => {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (h: number) => void;
  };

  if (typeof w.requestIdleCallback === "function") {
    const handle = w.requestIdleCallback(run, { timeout: 1500 });
    return () => w.cancelIdleCallback?.(handle);
  }

  const timer = setTimeout(run, 800);
  return () => clearTimeout(timer);
};


type BootstrapEvent = {
  id: string;
  name: string;
  request_price: number | null;
  shoutout_price: number | null;
};

export default function RequestPage({
  bootstrap,
  bootstrapEvent = null,
  bootstrapFailed = false,
}: {
  /* Seeded by the server component. Null only when the DJ genuinely does
     not exist; a failed load arrives as bootstrapFailed instead, so the
     two are never confused again. */
  bootstrap: DJProfile | null;
  /* Already entitlement-resolved by the view: null for a Free DJ and
     null for a lapsed Pro DJ, with no way to tell which from here. */
  bootstrapEvent?: BootstrapEvent | null;
  bootstrapFailed?: boolean;
}) {
  const params = useParams();
  const djSlug = params.djSlug as string;

  /*
   * Seeded from the server render. The first client render therefore
   * produces exactly the markup the server sent — same DJ, same prices,
   * same availability — which is what keeps hydration quiet. The live
   * reconciliation below runs after mount and only changes anything if
   * the DJ actually changed something in the meantime.
   */
  const [djProfile, setDjProfile] = useState<DJProfile | null>(bootstrap);
  const [isLoadingDJ, setIsLoadingDJ] = useState(false);
  const [djNotFound, setDjNotFound] = useState(
    bootstrap === null && !bootstrapFailed
  );
  /* Distinct from djNotFound on purpose: a failure to load is not
     evidence that the DJ does not exist, and must not be rendered as
     though it were. */
  const [loadFailed, setLoadFailed] = useState(bootstrapFailed);
  /* Set by the profile effect below. Lets the submit path re-read the
     DJ's current pricing when the server says it has changed. */
  const refreshDJRef = useRef<(() => Promise<void>) | null>(null);

  const [activeEvent, setActiveEvent] = useState<{
    id: string;
    name: string;
    request_price: number | null;
    shoutout_price: number | null;
  } | null>(bootstrapEvent);

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
    /*
     * Reads the public bootstrap view, not dj_profiles.
     *
     * 5E added `plan, stripe_subscription_status` to a base-table query
     * that ran here, in a guest's browser, under the anon key. Those
     * columns are deliberately not granted to anon — they are commercial
     * account state — so PostgREST refused the whole query with 42501,
     * the catch turned that into "DJ Not Found", and every DJ's request
     * page died for every guest.
     *
     * The view answers the question those columns were added for without
     * publishing them: entitlement is evaluated inside Postgres and only
     * the result comes out, as an effective event and effective prices.
     * A Free DJ and a lapsed Pro DJ are indistinguishable from here,
     * which is the point.
     *
     * It is also the same shape the server rendered from, so this
     * reconciliation cannot disagree with the first paint about which
     * columns exist — the two callers differ only in whether they ask
     * for `bio`, which the server leaves out of the first paint.
     */
    const PROFILE_SELECT =
      "id, dj_name, request_status, last_active_at, auto_close_at, genres, bio, " +
      "profile_image_url, effective_request_price, effective_shoutout_price, " +
      "effective_event_id, effective_event_name";

    type EmbeddedEvent = {
      id: string;
      name: string;
      request_price: number | null;
      shoutout_price: number | null;
      is_active?: boolean | null;
    };

    const readProfile = async () => {
      const supabase = await getSupabase();

      const { data, error } = await supabase
        .from("public_dj_request_bootstrap")
        .select(PROFILE_SELECT)
        .eq("slug", djSlug)
        .maybeSingle();

      /*
       * A failed reconciliation leaves the server's data on screen. It
       * does not blank the page, does not show a loading state over
       * content the guest is already reading, and above all does not
       * decide the DJ has ceased to exist because one fetch failed.
       */
      if (error) return { profile: null, event: null, failed: true };

      if (!data) return { profile: null, event: null, failed: false };

      const row = data as unknown as Record<string, unknown>;

      /* Mapped back onto the shape the rest of this page already speaks,
         so nothing downstream had to change: the view hands over
         effective prices, which is what the guest is quoted. */
      const profile: Record<string, unknown> = {
        id: row.id,
        dj_name: row.dj_name,
        request_status: row.request_status,
        last_active_at: row.last_active_at,
        auto_close_at: row.auto_close_at,
        genres: row.genres,
        bio: row.bio,
        profile_image_url: row.profile_image_url ?? null,
        request_price: row.effective_request_price,
        shoutout_price: row.effective_shoutout_price,
      };

      const event: EmbeddedEvent | null =
        typeof row.effective_event_id === "string" && row.effective_event_id
          ? {
              id: row.effective_event_id,
              name: String(row.effective_event_name ?? ""),
              request_price: null,
              shoutout_price: null,
            }
          : null;

      return { profile, event, failed: false };
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

    /*
     * On mount this is a reconciliation, not a first load: the server
     * already rendered this DJ. It exists to catch anything that changed
     * between the server render and the guest's screen lighting up — a
     * pause, a price edit, an event starting.
     *
     * It therefore never shows a loading state (there is content on
     * screen to protect) and never blanks what the server rendered.
     */
    const loadDJ = async () => {
      const { profile, event, failed } = await readProfile();

      if (!isMounted) return;

      /*
       * Three outcomes kept apart, which is the whole point of this fix.
       *
       * failed  - keep whatever the server rendered and say nothing. A
       *           fetch that did not come back is not information about
       *           the DJ. If the server render also failed we are
       *           already showing the retry state.
       * absent  - a genuine 200-with-no-row. Only then is the DJ missing,
       *           and only if the server did not already find them (it
       *           may have raced a slug change).
       * present - reconcile.
       */
      if (failed) return;

      if (!profile) {
        if (!bootstrap) setDjNotFound(true);
        return;
      }

      applyProfile(profile, event);
      setDjNotFound(false);
      setLoadFailed(false);
    };

    const refreshDJ = async () => {
      const { profile, event, failed } = await readProfile();
      /* Same rule as above: a failed refresh leaves the last known good
         state alone rather than replacing it with nothing. */
      if (failed || !profile) return;
      applyProfile(profile, event);
    };

    /* The poll owns the only copy of this logic, so the submit path
       borrows it rather than growing a second one that could read the
       event differently. */
    refreshDJRef.current = refreshDJ;

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

    /*
     * loadDJ has moved into the idle callback below, alongside the
     * realtime subscription, because both need the lazily-loaded
     * Supabase client and should share one download.
     *
     * fetchVipStatus stays here and runs immediately: it is a plain
     * fetch to our own API with no Supabase dependency, and it is the
     * one piece of state the server bootstrap does not carry.
     */
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

    /*
     * Subscribed once the client has actually loaded, which is now an
     * await rather than a module import. The cancelled flag closes the
     * race where the guest leaves before the download finishes: without
     * it, a channel could be created after cleanup had already run and
     * would never be torn down.
     */
    let channel: Awaited<ReturnType<typeof createChannel>> | null = null;

    const createChannel = async () => {
      const supabase = await getSupabase();

      return supabase
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
    };

    const cancelIdle = whenIdle(() => {
      if (!isMounted) return;

      /* The reconciliation read and the realtime subscription share the
         same client, so this is one download for both. */
      loadDJ();

      createChannel().then((created) => {
        if (!isMounted) {
          /* Cleanup already ran — tear this down rather than leaking it. */
          getSupabase().then((supabase) => supabase.removeChannel(created));
          return;
        }
        channel = created;
      });
    });

    return () => {
      isMounted = false;
      cancelIdle();
      stopTimers();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) {
        const open = channel;
        getSupabase().then((supabase) => supabase.removeChannel(open));
      }
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
  /*
   * A guest browsing for a second song still has an earlier request out
   * for a decision, so status changes surface here as toasts too.
   *
   * This used to be its own 4-second fetch loop — a second polling
   * implementation alongside useRequestStatus, with none of its abort,
   * in-flight or unmount guards, and no visibility handling, so it kept
   * polling in a pocketed phone. It now shares the one hook, which means
   * one definition of the cadence and one definition of what a bad
   * signal looks like.
   */
  const trackedIds = useSyncExternalStore(
    subscribeGuestRequestIds,
    () => getGuestRequestIdsSnapshot(djSlug),
    getGuestRequestIdsServerSnapshot
  );

  const { requests: myRequests } = useRequestStatus(
    trackedIds.length > 0 ? trackedIds : null
  );

  useEffect(() => {
    if (myRequests.length === 0) return;

    /* First response is the baseline, not a burst of notifications for
       things that happened before the guest opened the page. */
    if (previousRequestStatusesRef.current === null) {
      previousRequestStatusesRef.current = new Map(
        myRequests.map((request) => [request.id, request.request_status])
      );
      return;
    }

    const previous = previousRequestStatusesRef.current;

    myRequests.forEach((request) => {
      const before = previous.get(request.id);
      previous.set(request.id, request.request_status);

      if (!before || before === request.request_status) return;

      const copy = requestStatusNotificationCopy(request.request_status);
      if (!copy) return;

      toast(request.song_title, { description: copy });

      if (
        getGuestNotificationsEnabled() &&
        document.visibilityState !== "visible"
      ) {
        showBrowserNotification(request.song_title, copy);
      }
    });
  }, [myRequests]);

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
        /*
         * The pricing context this page is currently showing. The server
         * never uses it as a price — it compares it against its own
         * answer and refuses if they differ, so a DJ switching or ending
         * an event while a guest is choosing a song can no longer show
         * one price and charge another.
         */
        eventId: activeEvent?.id ?? null,
        eventContextKnown: true,
      }),
    });

    const createData = await createResponse.json();

    if (!createResponse.ok || !createData.requestId) {
      console.log("Request create error:", createData.error);

      /* The DJ changed their pricing mid-choice. Reload what it costs
         now and let the guest decide again, rather than sending them
         into Stripe at a price they never agreed to. */
      if (createData.code === "event_changed") {
        await refreshDJRef.current?.();
        toast.error(createData.error);
        return;
      }

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

  /*
   * Ordered before the not-found branch deliberately. A bootstrap or
   * network failure must never be able to fall through into "DJ Not
   * Found" — that is the exact wording that told every guest their
   * working DJ did not exist during the 2026-09-03 outage.
   */
  if (loadFailed) {
    return (
      <main className="min-h-screen bg-canvas p-6 text-white">
        <section className="mx-auto flex min-h-screen max-w-xl items-center justify-center">
          <Card variant="elevated" className="p-8 text-center">
            <h1 className="text-h2">Can&apos;t load this page</h1>

            <p className="mt-4 text-zinc-400">
              Something went wrong at our end, not yours. The DJ is
              probably fine — try again in a moment.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className={buttonVariants({ className: "mt-6" })}
            >
              Try again
            </button>

            <p className="mt-4 text-xs text-zinc-500">
              If this keeps happening, ask the DJ to check their link.
            </p>
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

        {/* min-height, not a fixed height: the card expands when a guest
            opens it, and this must reserve the collapsed footprint
            without capping the open one. */}
        <div className="mt-4 min-h-[62px]">
          <TipCard djSlug={djSlug} isTakingRequests={isTakingRequests} />
        </div>
      </section>
    </main>
  );
}
