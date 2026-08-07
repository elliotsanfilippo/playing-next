"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ListMusic,
  CheckCircle2,
  XCircle,
  Percent,
  PoundSterling,
} from "lucide-react";
import { supabase } from "../../../src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import StatCard from "@/src/components/ui/StatCard";
import Eyebrow from "@/src/components/ui/Eyebrow";

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
      ? (
          (analytics.acceptedRequests / analytics.totalRequests) *
          100
        ).toFixed(1)
      : "0";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-white">
        <Card variant="elevated" className="p-8 text-center">
          <p className="text-sm text-zinc-400">Playing Next</p>
          <h1 className="mt-3 text-h2">Loading analytics...</h1>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas p-5 text-white sm:p-6">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow tone="accent">Playing Next</Eyebrow>
            <h1 className="mt-2 text-h1">Analytics</h1>
            <p className="mt-2 text-zinc-400">
              Track request activity and estimated revenue.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => router.push("/dj/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Requests"
            value={analytics.totalRequests}
            icon={<ListMusic size={20} />}
            tone="neutral"
          />

          <StatCard
            label="Accepted"
            value={analytics.acceptedRequests}
            icon={<CheckCircle2 size={20} />}
            tone="accent"
          />

          <StatCard
            label="Declined"
            value={analytics.declinedRequests}
            icon={<XCircle size={20} />}
            tone="danger"
          />

          <StatCard
            label="Acceptance Rate"
            value={`${acceptanceRate}%`}
            icon={<Percent size={20} />}
            tone="info"
          />

          <StatCard
            label="Revenue"
            value={`£${analytics.totalRevenue.toFixed(2)}`}
            icon={<PoundSterling size={20} />}
            tone="accent"
          />
        </div>

        <Card variant="flat" className="mt-8 p-5 sm:p-6">
          <h2 className="text-h3">Most Requested Songs</h2>

          <div className="mt-6 space-y-3">
            {topSongs.length === 0 ? (
              <p className="text-zinc-400">No requests yet.</p>
            ) : (
              topSongs.map((song, index) => (
                <div
                  key={song.song_title}
                  className="flex flex-col gap-3 rounded-control bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
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
        </Card>
      </section>
    </main>
  );
}
