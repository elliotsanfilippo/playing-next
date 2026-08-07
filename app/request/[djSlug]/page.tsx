"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
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
import Card from "@/src/components/ui/Card";


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

    try {
      const response = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(value)}`
      );

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const data = await response.json();
      setTracks(data);
    } catch (error) {
      console.log("Spotify search error:", error);
      toast.error("Song search is temporarily unavailable. Please try again.", {
        id: "spotify-search-error",
      });
    }
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
      toast.error("Please add a message for your Song + Message request.");
      return;
    }

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

  <Card variant="elevated" className="mt-6 p-6 sm:p-8">
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
      />
    </Card>

    <Card variant="elevated" className="mt-6 p-6 sm:p-8">
      <CheckoutButton
        selectedSong
        isTakingRequests={isTakingRequests}
        requestType={requestType}
        requestPrice={requestPrice}
        shoutoutPrice={shoutoutPrice}
        onCheckout={submitRequest}
      />
    </Card>
  </>
)}
        
      </section>
    </main>
  );
}