"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../src/lib/supabase";
import { useParams } from "next/navigation";

type DJProfile = {
  id: string;
  dj_name: string;
  request_status: string;
  genres: string[] | string | null;
  bio: string | null;
  request_price: number | null;
  profile_image_url: string | null;
};

type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
};

export default function RequestPage() {
  const [djProfile, setDjProfile] = useState<DJProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [selectedSong, setSelectedSong] = useState<SpotifyTrack | null>(null);
  const [djNotFound, setDjNotFound] = useState(false);

  const params = useParams();
  const djSlug = params.djSlug as string;

  const fetchDJProfile = async () => {
    const { data, error } = await supabase
  .from("dj_profiles")
  .select("id, dj_name, request_status, genres, bio, request_price, profile_image_url")
  .eq("slug", djSlug)
  .single();

    if (error || !data) {
  console.log("DJ profile not found:", error);
  setDjNotFound(true);
  return;
}

setDjNotFound(false);
setDjProfile(data);
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
  fetchDJProfile();

  const channel = supabase
  .channel(`request_page_${djSlug}`)
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "dj_profiles",
    },
    () => fetchDJProfile()
  )
  .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [djSlug]);

  const isTakingRequests = djProfile?.request_status === "taking_requests";

  const submitRequest = async () => {
    if (!selectedSong || !djProfile || !isTakingRequests) return;

    const { data: existingRequests } = await supabase
      .from("song_requests")
      .select("id")
      .in("request_status", ["pending", "accepted", "playing_next"]);

    const nextQueuePosition = (existingRequests?.length || 0) + 1;

    const { data, error } = await supabase
      .from("song_requests")
      .insert({
        dj_profile_id: djProfile.id,
        song_title: selectedSong.title,
        artist: selectedSong.artist,
        message: "",
        request_status: "pending",
        queue_position: nextQueuePosition,
      })
      .select()
      .single();

    if (error || !data) {
  console.log("DJ profile not found:", error);
  alert(`No DJ found for slug: ${djSlug}`);
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
  requestPrice: djProfile.request_price || 500,
}),
});

    const checkoutData = await checkoutResponse.json();

    window.location.href = checkoutData.url;
  };
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
      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center gap-4">
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
              {djProfile?.dj_name || "Loading DJ..."}
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
    className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white"
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

        <div className="mt-10 rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Request a Song</h2>

              <p className="mt-2 text-zinc-400">
                Search Spotify and choose a track.
              </p>
            </div>

            <div className="rounded-full bg-white px-4 py-2 font-semibold text-black">
              £{((djProfile?.request_price || 500) / 100).toFixed(2)} Request
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
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedSong?.id === track.id
                    ? "border-green-500 bg-green-500/10"
                    : "border-white/10 bg-zinc-950 hover:border-white/30"
                }`}
              >
                <div>
                  <h3 className="font-semibold">{track.title}</h3>

                  <p className="text-sm text-zinc-400">{track.artist}</p>
                </div>

                <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
                  {selectedSong?.id === track.id ? "Selected" : "Select"}
                </div>
              </button>
            ))}
          </div>

          {selectedSong && (
            <div className="mt-8 rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm text-green-400">Selected Song</p>

              <h3 className="mt-2 text-xl font-semibold">
                {selectedSong.title}
              </h3>

              <p className="text-zinc-300">{selectedSong.artist}</p>
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
                ? `Continue with ${selectedSong.title}`
                : "Select a Song First"}
          </button>
        </div>
      </section>
    </main>
  );
}