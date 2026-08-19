"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag, LogOut, Search, AlertTriangle } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Badge from "@/src/components/ui/Badge";
import Button from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";
import NotFound from "@/app/not-found";
import { supabase } from "@/src/lib/supabase";

type DjStat = {
  id: string;
  dj_name: string;
  slug: string;
  plan: string | null;
  request_status: string;
  created_at: string;
  accepted_ever: number;
  played: number;
  not_played_reports: number;
  dispute_rate: number;
  net_earnings: number;
  missing_earnings_count: number;
};

type Report = {
  id: string;
  reason: string | null;
  resolution: "pending" | "refunded" | "denied";
  created_at: string;
  resolved_at: string | null;
  song_requests: { song_title: string; artist: string } | null;
  dj_profiles: { dj_name: string; slug: string } | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [djs, setDjs] = useState<DjStat[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/admin/login");
      return;
    }

    const headers = { Authorization: `Bearer ${session.access_token}` };

    const [djsResponse, reportsResponse] = await Promise.all([
      fetch("/api/admin/djs", { headers }),
      fetch("/api/admin/reports", { headers }),
    ]);

    if (djsResponse.status === 403 || reportsResponse.status === 403) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    const djsResult = await djsResponse.json();
    const reportsResult = await reportsResponse.json();

    setDjs(djsResult.djs || []);
    setReports(reportsResult.reports || []);
    setAuthorized(true);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const resolveReport = async (reportId: string, resolution: "refunded" | "denied") => {
    if (resolvingId) return;

    setResolvingId(reportId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch("/api/admin/reports/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reportId, resolution }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update this report.");
      }

      toast.success(
        resolution === "refunded" ? "Marked as refunded." : "Marked as denied."
      );
      loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update this report."
      );
    } finally {
      setResolvingId(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas text-white">
        <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
      </main>
    );
  }

  /*
   * Deliberately renders the site's normal 404 rather than a "Not
   * authorized" message — a distinct denial screen would confirm to
   * anyone who stumbles onto this URL that an admin area exists at
   * all. The real access control is server-side in each /api/admin/*
   * route (getAdminUser), not this page shell.
   */
  if (!authorized) {
    return <NotFound />;
  }

  const pendingReports = reports.filter((r) => r.resolution === "pending");
  const resolvedReports = reports.filter((r) => r.resolution !== "pending");

  const filteredDjs = djs.filter((dj) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      dj.dj_name.toLowerCase().includes(query) ||
      dj.slug.toLowerCase().includes(query)
    );
  });

  const liveNow = djs.filter((dj) => dj.request_status === "taking_requests").length;

  return (
    <main className="min-h-screen bg-canvas p-5 text-white sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Eyebrow tone="accent">Admin</Eyebrow>
            <h1 className="mt-2 text-h1">Platform Overview</h1>
            <p className="mt-2 text-zinc-400">
              DJ activity, trust metrics and guest-reported disputes.
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={signOut} className="shrink-0">
            <LogOut size={15} className="mr-1.5" />
            Sign Out
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-xs text-zinc-500">Total DJs</p>
            <p className="mt-2 text-2xl font-bold">{djs.length}</p>
          </Card>

          <Card className="p-4">
            <p className="text-xs text-zinc-500">Live Now</p>
            <p className="mt-2 text-2xl font-bold">{liveNow}</p>
          </Card>

          <Card className="p-4">
            <p className="text-xs text-zinc-500">Pending Reports</p>
            <p
              className={`mt-2 text-2xl font-bold ${pendingReports.length > 0 ? "text-amber-400" : ""}`}
            >
              {pendingReports.length}
            </p>
          </Card>
        </div>

        <Card variant="elevated" className="mt-8 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-white/5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-h3">DJs</h2>

            <div className="relative w-full sm:w-64">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search DJs..."
                className="h-10 w-full rounded-control border border-white/10 bg-black/30 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-accent/40"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-6 py-3 font-semibold">DJ</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Accepted</th>
                  <th className="px-4 py-3 font-semibold">Played</th>
                  <th className="px-4 py-3 font-semibold">Reports</th>
                  <th className="px-4 py-3 font-semibold">Dispute rate</th>
                  <th className="px-6 py-3 font-semibold">Net earnings</th>
                </tr>
              </thead>
              <tbody>
                {filteredDjs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-zinc-500">
                      {djs.length === 0 ? "No DJs yet." : "No DJs match your search."}
                    </td>
                  </tr>
                ) : (
                  filteredDjs.map((dj) => (
                    <tr key={dj.id} className="border-b border-white/5 last:border-0">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-white">{dj.dj_name}</p>
                        <p className="text-xs text-zinc-500">{dj.slug}</p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={dj.request_status === "taking_requests" ? "accent" : "neutral"} dot>
                          {dj.request_status === "taking_requests" ? "Live" : "Paused"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{dj.plan || "free"}</td>
                      <td className="px-4 py-4 text-zinc-300">{dj.accepted_ever}</td>
                      <td className="px-4 py-4 text-zinc-300">{dj.played}</td>
                      <td className="px-4 py-4 text-zinc-300">{dj.not_played_reports}</td>
                      <td className="px-4 py-4">
                        <span
                          className={
                            dj.dispute_rate > 0.1 ? "font-semibold text-red-400" : "text-zinc-300"
                          }
                        >
                          {(dj.dispute_rate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-300">
                        £{dj.net_earnings.toFixed(2)}
                        {dj.missing_earnings_count > 0 && (
                          <span
                            title={`${dj.missing_earnings_count} played/accepted request(s) are missing pricing data (from before financial tracking was added on 2026-08-08) and aren't included in this total — the real figure is likely higher.`}
                            className="ml-1.5 inline-flex cursor-help items-center gap-1 text-xs font-semibold text-amber-400"
                          >
                            <AlertTriangle size={12} />
                            incomplete
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card variant="elevated" className="mt-8 overflow-hidden">
          <div className="border-b border-white/5 p-6">
            <h2 className="text-h3">
              Not Played Reports{" "}
              {pendingReports.length > 0 && (
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  ({pendingReports.length} pending)
                </span>
              )}
            </h2>
          </div>

          <div className="divide-y divide-white/5">
            {reports.length === 0 ? (
              <p className="p-8 text-center text-zinc-500">No reports yet.</p>
            ) : (
              [...pendingReports, ...resolvedReports].map((report) => (
                <div key={report.id} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Flag size={14} className="text-zinc-500" />
                      <p className="font-semibold text-white">
                        {report.song_requests?.song_title || "Unknown song"}
                      </p>
                      <span className="text-zinc-500">
                        {report.song_requests?.artist}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-zinc-400">
                      {report.dj_profiles?.dj_name || "Unknown DJ"} ·{" "}
                      {new Date(report.created_at).toLocaleString()}
                    </p>

                    {report.reason && (
                      <p className="mt-2 rounded-control border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                        {report.reason}
                      </p>
                    )}

                    <Badge
                      tone={
                        report.resolution === "pending"
                          ? "warning"
                          : report.resolution === "refunded"
                            ? "accent"
                            : "neutral"
                      }
                      className="mt-3"
                    >
                      {report.resolution}
                    </Badge>
                  </div>

                  {report.resolution === "pending" && (
                    <div className="flex shrink-0 gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => resolveReport(report.id, "denied")}
                        disabled={resolvingId === report.id}
                      >
                        Deny
                      </Button>

                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => resolveReport(report.id, "refunded")}
                        disabled={resolvingId === report.id}
                      >
                        Mark Refunded
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
