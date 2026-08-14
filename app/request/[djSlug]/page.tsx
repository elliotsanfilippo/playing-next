"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "../../../src/lib/supabase";
import { isEffectivelyTakingRequests } from "@/src/lib/djActivity";
import {
  getGuestNotificationsEnabled,
  showBrowserNotification,
} from "@/src/lib/notifications";
import { requestStatusNotificationCopy } from "@/src/lib/requestStatus";
import RequestHeader, {
  type DJProfile,
} from "@/src/components/request/RequestHeader";

import RequestCardHeader from "@/src/components/request/RequestCardHeader";
import SpotifySearchInput from "@/src/components/request/SpotifySearchInput";
import TrackResults, {
  type SpotifyTrack,
} from "@/src/components/request/TrackResults";
import SelectedSong from "@/src/components/request/SelectedSong";
import RequestOptions from "@/src/components/request/RequestOptions";
import CheckoutButton from "@/src/components/request/CheckoutButton";
import TipCard from "@/src/components/request/TipCard";
import EmptySearchState from "@/src/components/request/EmptySearchState";
import Card from "@/src/components/ui/Card";
import { buttonVariants } from "@/src/components/ui/Button";


export default function RequestPage() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  const [djProfile, setDjProfile] = useState<DJProfile | null>(null);
  const [isLoadingDJ, setIsLoadingDJ] = useState(true);
  const [djNotFound, setDjNotFound] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [selectedSong, setSelectedSong] = useState<SpotifyTrack | null>(null);

  const [requestType, setRequestType] = useState<
    "song_request" | "song_message"
  >("song_request");

  const [message, setMessage] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [vipAvailable, setVipAvailable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const previousRequestStatusesRef = useRef<Map<string, string> | null>(
    null
  );

  const searchAbortControllerRef = useRef<AbortController | null>(null);

  const fetchDJProfile = async (showLoading = false) => {
  if (showLoading) {
    setIsLoadingDJ(true);
  }

  const { data, error } = await supabase
    .from("dj_profiles")
    .select(
      "id, dj_name, request_status, last_active_at, genres, bio, request_price, shoutout_price, profile_image_url"
    )
    .eq("slug", djSlug)
    .maybeSingle();

  if (error || !data) {
    console.log("DJ profile not found:", error);
    setDjProfile(null);
    setDjNotFound(true);
    setIsLoadingDJ(false);
    return;
  }

  setDjProfile(data);
  setDjNotFound(false);
  setIsLoadingDJ(false);
};

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
   * Debounced rather than firing on every keystroke — searching "levels"
   * used to mean 6 separate Spotify calls instead of 1. 300ms is short
   * enough to still feel instant, long enough to skip past mid-word
   * keystrokes for anyone typing at a normal pace.
   */
  useEffect(() => {
    if (searchQuery.length < 2) {
      setTracks([]);
      return;
    }

    const timeout = setTimeout(async () => {
      searchAbortControllerRef.current?.abort();
      const controller = new AbortController();
      searchAbortControllerRef.current = controller;

      try {
        const response = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(searchQuery)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }

        const data = await response.json();
        setTracks(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.log("Spotify search error:", error);
        toast.error(
          "Song search is temporarily unavailable. Please try again.",
          { id: "spotify-search-error" }
        );
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
  let isMounted = true;

  const fetchVipStatus = async () => {
    try {
      const response = await fetch(`/api/vip-status/${djSlug}`);
      const data = await response.json();

      if (!isMounted) return;
      if (response.ok) setVipAvailable(data.vipAvailable !== false);
    } catch (error) {
      console.log("VIP status fetch error:", error);
    }
  };

  const loadDJ = async () => {
    setIsLoadingDJ(true);
    setDjProfile(null);
    setDjNotFound(false);

    const { data, error } = await supabase
      .from("dj_profiles")
      .select(
        "id, dj_name, request_status, last_active_at, genres, bio, request_price, shoutout_price, profile_image_url"
      )
      .eq("slug", djSlug)
      .maybeSingle();

    if (!isMounted) return;

    if (error || !data) {
      console.log("DJ profile not found:", error);
      setDjNotFound(true);
      setIsLoadingDJ(false);
      return;
    }

    setDjProfile(data);
    if (!isEffectivelyTakingRequests(data)) {
  setSearchQuery("");
  setTracks([]);
  setSelectedSong(null);
  setMessage("");
  setRequestType("song_request");
  setIsVip(false);
}
    setDjNotFound(false);
    setIsLoadingDJ(false);
  };

  const refreshDJ = async () => {
    const { data } = await supabase
      .from("dj_profiles")
      .select(
        "id, dj_name, request_status, last_active_at, genres, bio, request_price, shoutout_price, profile_image_url"
      )
      .eq("slug", djSlug)
      .maybeSingle();

    if (!isMounted || !data) return;

    setDjProfile(data);
    if (!isEffectivelyTakingRequests(data)) {
  setSearchQuery("");
  setTracks([]);
  setSelectedSong(null);
  setMessage("");
  setRequestType("song_request");
  setIsVip(false);
}
  };

  loadDJ();
  fetchVipStatus();
const interval = setInterval(() => {
  refreshDJ();
  fetchVipStatus();
}, 5000);
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
const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    refreshDJ();
    fetchVipStatus();
  }
};

document.addEventListener(
  "visibilitychange",
  handleVisibilityChange
);
  return () => {
  isMounted = false;

  clearInterval(interval);

  document.removeEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

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
      let myRequestIds: string[] = [];

      try {
        myRequestIds = JSON.parse(
          localStorage.getItem(`myRequestIds_${djSlug}`) || "[]"
        );
      } catch (error) {
        console.log("localStorage parse error", error);
        return;
      }

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

  const isTakingRequests = Boolean(
    djProfile && isEffectivelyTakingRequests(djProfile)
  );

  const requestPrice = djProfile?.request_price || 500;
  const shoutoutPrice = djProfile?.shoutout_price || 800;

  const submitRequest = async () => {
    if (!selectedSong || !djProfile || !isTakingRequests || submitting) return;

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

    let existingMyRequests: string[] = [];

try {
  existingMyRequests = JSON.parse(
    localStorage.getItem(`myRequestIds_${djSlug}`) || "[]"
  );
} catch (error) {
  console.log("localStorage parse error", error);
  existingMyRequests = [];
}

localStorage.setItem(
  `myRequestIds_${djSlug}`,
  JSON.stringify([
    requestId,
    ...existingMyRequests.filter((id: string) => id !== requestId),
  ])
);

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
      <section className="mx-auto max-w-4xl px-5 py-8 sm:px-6 sm:py-12">
        <RequestHeader
  djSlug={djSlug}
  djProfile={djProfile!}
  isTakingRequests={isTakingRequests}
/>

  <TipCard djSlug={djSlug} isTakingRequests={isTakingRequests} />

  <Card variant="elevated" className="mt-6 p-6 sm:p-8">
  <RequestCardHeader />

  <SpotifySearchInput
    searchQuery={searchQuery}
    isTakingRequests={isTakingRequests}
    onSearch={setSearchQuery}
  />

  {!selectedSong &&
    tracks.length === 0 &&
    searchQuery.length < 2 &&
    isTakingRequests && (
      <EmptySearchState />
    )}
</Card>

{!selectedSong && tracks.length > 0 && (
  <TrackResults
    tracks={tracks}
    selectedSong={selectedSong}
    isTakingRequests={isTakingRequests}
    onSelect={setSelectedSong}
  />
)}

          {selectedSong && (
  <>
    <Card variant="elevated" className="mt-6 p-6 sm:p-8">
      <SelectedSong
        selectedSong={selectedSong}
        onChangeSong={() => {
          setSelectedSong(null);
          setSearchQuery("");
          setTracks([]);
          setMessage("");
          setRequestType("song_request");
          setIsVip(false);
        }}
      />
    </Card>

    <Card variant="elevated" className="mt-6 p-6 sm:p-8">
      <RequestOptions
        requestType={requestType}
        setRequestType={setRequestType}
        requestPrice={requestPrice}
        shoutoutPrice={shoutoutPrice}
        message={message}
        setMessage={setMessage}
        isTakingRequests={isTakingRequests}
        isVip={isVip}
        setIsVip={setIsVip}
        vipAvailable={vipAvailable}
      />
    </Card>

    <Card variant="elevated" className="mt-6 p-6 sm:p-8">
      <CheckoutButton
        selectedSong
        isTakingRequests={isTakingRequests}
        requestType={requestType}
        requestPrice={requestPrice}
        shoutoutPrice={shoutoutPrice}
        isVip={isVip}
        submitting={submitting}
        onCheckout={submitRequest}
      />
    </Card>
  </>
)}
        
      </section>
    </main>
  );
}