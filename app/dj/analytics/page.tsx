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

type SongRequest = {
  request_status: string;
  song_title: string | null;
  request_type: string | null;
};

export default function AnalyticsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

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
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("dj_profiles")
      .select("id, request_price, shoutout_price")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.log("Analytics profile load error:", profileError);
      setLoading(false);
      return;
    }

    const { data: requests, error: requestsError } = await supabase
      .from("song_requests")
      .select("request_status, song_title, request_type")
      .eq("dj_profile_id", profile.id);

    if (requestsError) {
      console.log("Analytics requests load error:", requestsError);
      setLoading(false);
      return;
    }

    const typedRequests = (requests || []) as SongRequest[];

    const totalRequests = typedRequests.length;

    const completedRequests = typedRequests.filter(
      (request) =>
        request.request_status === "accepted" ||
        request.request_status === "playing_next" ||
        request.request_status === "played"
    );

    const acceptedRequests = completedRequests.length;

    const declinedRequests = typedRequests.filter(
      (request) => request.request_status === "declined"
    ).length;

    const totalRevenue =
      completedRequests.reduce((total, request) => {
        const price =
          request.request_type === "song_message"
            ? profile.shoutout_price || 800
            : profile.request_price || 500;

        return total + price;
      }, 0) / 100;

    const songCounts: Record<string, number> = {};

    typedRequests.forEach((request) => {
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

    setLoading(false);
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const acceptanceRate =
    analytics.totalRequests > 0
      ? ((analytics.acceptedRequests / analytics.totalRequests) * 100).toFixed(1)
      : "0";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center">
          <p className="text-sm text-zinc-400">Playing Next</p>
          <h1 className="mt-3 text-3xl font-bold">
            Loading analytics...
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-5 text-white sm:p-6">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-400">Playing Next</p>

            <h1 className="mt-2 text-4xl font-bold">Analytics</h1>

            <p className="mt-2 text-zinc-400">
              Track request activity and estimated revenue.
            </p>
          </div>

          <button
            onClick={() => router.push("/dj/dashboard")}
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5 sm:p-6">
            <p className="text-sm text-zinc-400">Total Requests</p>

            <h2 className="mt-4 text-4xl font-bold">
              {analytics.totalRequests}
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5 sm:p-6">
            <p className="text-sm text-zinc-400">Accepted</p>

            <h2 className="mt-4 text-4xl font-bold text-green-400">
              {analytics.acceptedRequests}
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5 sm:p-6">
            <p className="text-sm text-zinc-400">Declined</p>

            <h2 className="mt-4 text-4xl font-bold text-red-400">
              {analytics.declinedRequests}
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5 sm:p-6">
            <p className="text-sm text-zinc-400">Acceptance Rate</p>

            <h2 className="mt-4 text-4xl font-bold">
              {acceptanceRate}%
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5 sm:p-6">
            <p className="text-sm text-zinc-400">Revenue</p>

            <h2 className="mt-4 text-4xl font-bold text-green-400">
              £{analytics.totalRevenue.toFixed(2)}
            </h2>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-2xl font-semibold">
            Most Requested Songs
          </h2>

          <div className="mt-6 space-y-3">
            {topSongs.length === 0 ? (
              <p className="text-zinc-400">No requests yet.</p>
            ) : (
              topSongs.map((song, index) => (
                <div
                  key={song.song_title}
                  className="flex flex-col gap-3 rounded-2xl bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="font-semibold">
                    #{index + 1} {song.song_title}
                  </p>

                  <div className="w-fit rounded-full bg-white/10 px-4 py-2 text-sm">
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