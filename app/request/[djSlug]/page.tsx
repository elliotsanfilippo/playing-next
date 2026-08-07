"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";
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
import EmptySearchState from "@/src/components/request/EmptySearchState";


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

  const fetchDJProfile = async (showLoading = false) => {
  if (showLoading) {
    setIsLoadingDJ(true);
  }

  const { data, error } = await supabase
    .from("dj_profiles")
    .select(
      "id, dj_name, request_status, genres, bio, request_price, shoutout_price, profile_image_url"
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

  const searchSpotify = async (value: string) => {
    setSearchQuery(value);

    if (value.length < 2) {
      setTracks([]);
      return;
    }

    const response = await fetch(
      `/api/spotify/search?q=${encodeURIComponent(value)}`
    );

    const data = await response.json();
    setTracks(data);
  };

  useEffect(() => {
  let isMounted = true;

  const loadDJ = async () => {
    setIsLoadingDJ(true);
    setDjProfile(null);
    setDjNotFound(false);

    const { data, error } = await supabase
      .from("dj_profiles")
      .select(
        "id, dj_name, request_status, genres, bio, request_price, shoutout_price, profile_image_url"
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
    if (data.request_status !== "taking_requests") {
  setSearchQuery("");
  setTracks([]);
  setSelectedSong(null);
  setMessage("");
  setRequestType("song_request");
}
    setDjNotFound(false);
    setIsLoadingDJ(false);
  };

  const refreshDJ = async () => {
    const { data } = await supabase
      .from("dj_profiles")
      .select(
        "id, dj_name, request_status, genres, bio, request_price, shoutout_price, profile_image_url"
      )
      .eq("slug", djSlug)
      .maybeSingle();

    if (!isMounted || !data) return;

    setDjProfile(data);
    if (data.request_status !== "taking_requests") {
  setSearchQuery("");
  setTracks([]);
  setSelectedSong(null);
  setMessage("");
  setRequestType("song_request");
}
  };

  loadDJ();
const interval = setInterval(() => {
  refreshDJ();
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

  const isTakingRequests = djProfile?.request_status === "taking_requests";

  const requestPrice = djProfile?.request_price || 500;
  const shoutoutPrice = djProfile?.shoutout_price || 800;

  const submitRequest = async () => {
    if (!selectedSong || !djProfile || !isTakingRequests) return;

    if (requestType === "song_message" && message.trim().length === 0) {
      alert("Please add a message for your Song + Message request.");
      return;
    }

    const { data: existingRequests } = await supabase
      .from("song_requests")
      .select("id")
      .eq("dj_profile_id", djProfile.id)
      .in("request_status", ["pending", "accepted", "playing_next"]);

    const nextQueuePosition = (existingRequests?.length || 0) + 1;

    const { data, error } = await supabase
      .from("song_requests")
      .insert({
  dj_profile_id: djProfile.id,
  song_title: selectedSong.title,
  artist: selectedSong.artist,
  request_status: "checkout_pending",
  queue_position: nextQueuePosition,
  request_type: requestType,
  message:
    requestType === "song_message"
      ? message.trim()
      : null,
})
      .select()
      .single();

    if (error || !data) {
      console.log("Request create error:", error);
      alert("Something went wrong creating your request.");
      return;
    }

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
    data.id,
    ...existingMyRequests.filter((id: string) => id !== data.id),
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
        requestId: data.id,
        djSlug,
        requestType,
        requestPrice:
          requestType === "song_message"
            ? shoutoutPrice
            : requestPrice,
      }),
    });

    const checkoutData = await checkoutResponse.json();

    window.location.href = checkoutData.url;
  };

  if (isLoadingDJ) {
    return (
      <main className="min-h-screen bg-canvas p-6 text-white">
        <section className="mx-auto flex min-h-screen max-w-xl items-center justify-center">
          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center">
            <p className="text-sm text-zinc-400">Playing Next</p>
            <h1 className="mt-3 text-3xl font-bold">Loading DJ...</h1>
          </div>
        </section>
      </main>
    );
  }

  if (djNotFound) {
    return (
      <main className="min-h-screen bg-canvas p-6 text-white">
        <section className="mx-auto flex min-h-screen max-w-xl items-center justify-center">
          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center">
            <h1 className="text-4xl font-bold">DJ Not Found</h1>

            <p className="mt-4 text-zinc-400">
              This request link is invalid or no longer active.
            </p>
          </div>
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

  <div className="mt-6 rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
  <RequestCardHeader />

  <SpotifySearchInput
    searchQuery={searchQuery}
    isTakingRequests={isTakingRequests}
    onSearch={searchSpotify}
  />

  {!selectedSong &&
    tracks.length === 0 &&
    searchQuery.length < 2 &&
    isTakingRequests && (
      <EmptySearchState />
    )}
</div>

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
    <div className="mt-6 rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
      <SelectedSong
        selectedSong={selectedSong}
        onChangeSong={() => {
          setSelectedSong(null);
          setSearchQuery("");
          setTracks([]);
          setMessage("");
          setRequestType("song_request");
        }}
      />
    </div>

    <div className="mt-6 rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
      <RequestOptions
        requestType={requestType}
        setRequestType={setRequestType}
        requestPrice={requestPrice}
        shoutoutPrice={shoutoutPrice}
        message={message}
        setMessage={setMessage}
        isTakingRequests={isTakingRequests}
      />
    </div>

    <div className="mt-6 rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
      <CheckoutButton
        selectedSong
        isTakingRequests={isTakingRequests}
        requestType={requestType}
        requestPrice={requestPrice}
        shoutoutPrice={shoutoutPrice}
        onCheckout={submitRequest}
      />
    </div>
  </>
)}
        
      </section>
    </main>
  );
}