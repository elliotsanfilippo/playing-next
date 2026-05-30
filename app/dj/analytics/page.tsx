"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";

type Analytics = {
  totalRequests: number;
  acceptedRequests: number;
  declinedRequests: number;
  totalRevenue: number;
};

export default function AnalyticsPage() {
  const router = useRouter();

  const [analytics, setAnalytics] = useState<Analytics>({
    
    totalRequests: 0,
    acceptedRequests: 0,
    declinedRequests: 0,
    totalRevenue: 0,
  });

  const [topSongs, setTopSongs] = useState<
  { song_title: string; count: number }[]
>([]);

  const fetchAnalytics = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("dj_profiles")
      .select("id, request_price")
      .eq("user_id", user.id)
      .single();

    if (!profile) return;

    const { data: requests } = await supabase
  .from("song_requests")
  .select("request_status, song_title")
  .eq("dj_profile_id", profile.id);

    const totalRequests = requests?.length || 0;

    const acceptedRequests =
      requests?.filter(
        (request) =>
          request.request_status === "accepted" ||
          request.request_status === "playing_next" ||
          request.request_status === "played"
      ).length || 0;

    const declinedRequests =
      requests?.filter(
        (request) =>
          request.request_status === "declined"
      ).length || 0;

    const totalRevenue =
      (acceptedRequests *
        (profile.request_price || 500)) /
      100;

const songCounts: Record<string, number> = {};

requests?.forEach((request) => {
  if (!request.song_title) return;

  songCounts[request.song_title] =
    (songCounts[request.song_title] || 0) + 1;
});

const topRequestedSongs = Object.entries(songCounts)
  .map(([song_title, count]) => ({
    song_title,
    count,
  }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 5);

setTopSongs(topRequestedSongs);

    setAnalytics({
      totalRequests,
      acceptedRequests,
      declinedRequests,
      totalRevenue,
    });
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const acceptanceRate =
    analytics.totalRequests > 0
      ? (
          (analytics.acceptedRequests /
            analytics.totalRequests) *
          100
        ).toFixed(1)
      : "0";

  return (
  <main className="min-h-screen bg-zinc-950 p-6 text-white">
    <section className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">Playing Next</p>

          <h1 className="mt-2 text-4xl font-bold">Analytics</h1>
        </div>

        <button
          onClick={() => router.push("/dj/dashboard")}
          className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Total Requests</p>

          <h2 className="mt-4 text-4xl font-bold">
            {analytics.totalRequests}
          </h2>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Accepted</p>

          <h2 className="mt-4 text-4xl font-bold text-green-400">
            {analytics.acceptedRequests}
          </h2>
        </div>
<div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
  <p className="text-sm text-zinc-400">
    Declined
  </p>

  <h2 className="mt-4 text-4xl font-bold text-red-400">
    {analytics.declinedRequests}
  </h2>
</div>
        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">
  Acceptance Rate
</p>

          <h2 className="mt-4 text-4xl font-bold text-white-400">
  {acceptanceRate}%
</h2>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Revenue</p>

          <h2 className="mt-4 text-4xl font-bold text-green-400">
            £{analytics.totalRevenue.toFixed(2)}
          </h2>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-900 p-6">
        <h2 className="text-2xl font-semibold">Most Requested Songs</h2>

        <div className="mt-6 space-y-3">
          {topSongs.length === 0 ? (
            <p className="text-zinc-400">No requests yet.</p>
          ) : (
            topSongs.map((song, index) => (
              <div
                key={song.song_title}
                className="flex items-center justify-between rounded-2xl bg-zinc-950 p-4"
              >
                <p className="font-semibold">
                  #{index + 1} {song.song_title}
                </p>

                <div className="rounded-full bg-white/10 px-4 py-2 text-sm">
                  {song.count} request{song.count !== 1 ? "s" : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  </main>
);
}