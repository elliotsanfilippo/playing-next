"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";

type DJProfile = {
  id: string;
  dj_name: string;
  request_status: string;
  genres: string[] | string | null;
  bio: string | null;
  request_price: number | null;
  shoutout_price: number | null;
  profile_image_url: string | null;
};

type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
  artwork: string | null;
};

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

    let existingMyRequests = [];

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
      JSON.stringify([...existingMyRequests, data.id])
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
      <main className="min-h-screen bg-black p-6 text-white">
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
      <main className="min-h-screen bg-black p-6 text-white">
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
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {djProfile?.profile_image_url ? (
            <img
              src={djProfile.profile_image_url}
              alt={djProfile.dj_name}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-zinc-800" />
          )}

          <div>
            <p className="text-sm text-zinc-400">Playing Next</p>

            <h1 className="mt-1 text-4xl font-bold">
              {djProfile?.dj_name}
            </h1>

            <p className="mt-2 text-zinc-400">
              {Array.isArray(djProfile?.genres)
                ? djProfile.genres.join(" • ")
                : djProfile?.genres || "Genres coming soon"}
            </p>

            {djProfile?.bio && (
              <p className="mt-2 max-w-xl text-zinc-400">
                {djProfile.bio}
              </p>
            )}

            <div className="mt-4">
              <a
                href={`/request/${djSlug}/my-requests`}
                className="inline-flex rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white"
              >
                View My Requests
              </a>
            </div>
          </div>
        </div>

        <div
          className={`mt-8 rounded-3xl border p-4 ${
            isTakingRequests
              ? "border-green-500/20 bg-green-500/10"
              : "border-red-500/20 bg-red-500/10"
          }`}
        >
          <p
            className={`font-semibold ${
              isTakingRequests ? "text-green-400" : "text-red-400"
            }`}
          >
            {isTakingRequests ? "Taking Requests" : "Requests Paused"}
          </p>

          <p className="mt-1 text-sm text-zinc-300">
            {isTakingRequests
              ? "Requests are currently open."
              : `${djProfile?.dj_name || "This DJ"} has stopped taking requests for now.`}
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-900 p-5 sm:mt-10 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Request a Song</h2>

              <p className="mt-2 text-zinc-400">
                Search Spotify and choose a track.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">
                Song £{(requestPrice / 100).toFixed(2)}
              </div>

              <div className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">
                Song + Message £{(shoutoutPrice / 100).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <label className="text-sm text-zinc-400">Search Song</label>

            <input
              disabled={!isTakingRequests}
              type="text"
              value={searchQuery}
              onChange={(event) => searchSpotify(event.target.value)}
              placeholder="Search Spotify..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="mt-6 space-y-3">
            {tracks.map((track) => (
              <button
                key={track.id}
                disabled={!isTakingRequests}
                onClick={() => setSelectedSong(track)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedSong?.id === track.id
                    ? "border-green-500 bg-green-500/10"
                    : "border-white/10 bg-zinc-950 hover:border-white/30"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {track.artwork ? (
                    <img
                      src={track.artwork}
                      alt={track.title}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-800" />
                  )}

                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">
                      {track.title}
                    </h3>

                    <p className="truncate text-sm text-zinc-400">
                      {track.artist}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
                  {selectedSong?.id === track.id ? "Selected" : "Select"}
                </div>
              </button>
            ))}
          </div>

          {selectedSong && (
            <div className="mt-8 rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm text-green-400">Selected Song</p>

              <div className="mt-3 flex items-center gap-4">
                {selectedSong.artwork ? (
                  <img
                    src={selectedSong.artwork}
                    alt={selectedSong.title}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-zinc-800" />
                )}

                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedSong.title}
                  </h3>

                  <p className="text-zinc-300">
                    {selectedSong.artist}
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedSong && (
            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={() => setRequestType("song_request")}
                className={`w-full rounded-2xl border p-4 text-left ${
                  requestType === "song_request"
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-zinc-950 text-white"
                }`}
              >
                Song Request (£{(requestPrice / 100).toFixed(2)})
              </button>

              <button
                type="button"
                onClick={() => setRequestType("song_message")}
                className={`w-full rounded-2xl border p-4 text-left ${
                  requestType === "song_message"
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-zinc-950 text-white"
                }`}
              >
                Song + Message (£{(shoutoutPrice / 100).toFixed(2)})
              </button>

              {requestType === "song_message" && (
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Add a birthday, hen do, stag do or shoutout message..."
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none"
                />
              )}
            </div>
          )}

          <button
            disabled={!selectedSong || !isTakingRequests}
            onClick={submitRequest}
            className={`mt-8 w-full rounded-2xl px-6 py-4 font-semibold transition ${
              selectedSong && isTakingRequests
                ? "bg-white text-black hover:opacity-90"
                : "cursor-not-allowed bg-zinc-800 text-zinc-500"
            }`}
          >
            {!isTakingRequests
              ? "Requests Paused"
              : selectedSong
                ? requestType === "song_message"
                  ? `Continue with ${selectedSong.title} + Message`
                  : `Continue with ${selectedSong.title}`
                : "Select a Song First"}
          </button>
        </div>
      </section>
    </main>
  );
}