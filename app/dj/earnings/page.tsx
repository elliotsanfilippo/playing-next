"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PoundSterling,
  Percent,
  Wallet,
  Clock,
  Download,
} from "lucide-react";
import { supabase } from "../../../src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import StatCard from "@/src/components/ui/StatCard";
import Eyebrow from "@/src/components/ui/Eyebrow";
import Badge from "@/src/components/ui/Badge";

type SongRequestFinancials = {
  id: string;
  song_title: string | null;
  artist: string | null;
  request_status: string;
  request_amount: number | null;
  guest_service_fee: number | null;
  platform_fee: number | null;
  dj_earnings: number | null;
  plan_at_checkout: string | null;
  created_at: string;
};

type Payout = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: number;
  created: number;
};

type PayoutsResponse = {
  connected: boolean;
  balance: { available: number; pending: number } | null;
  payouts: Payout[];
};

const COMPLETED_STATUSES = ["accepted", "playing_next", "played"];

function formatPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function EarningsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<SongRequestFinancials[]>([]);
  const [payoutInfo, setPayoutInfo] = useState<PayoutsResponse | null>(null);

  const fetchEarnings = async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("dj_profiles")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.log("Earnings profile load error:", profileError);
      setLoading(false);
      return;
    }

    const { data: requestRows, error: requestsError } = await supabase
      .from("song_requests")
      .select(
        `
          id,
          song_title,
          artist,
          request_status,
          request_amount,
          guest_service_fee,
          platform_fee,
          dj_earnings,
          plan_at_checkout,
          created_at
        `
      )
      .eq("dj_profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (requestsError) {
      console.log("Earnings requests load error:", requestsError);
      setLoading(false);
      return;
    }

    setRequests((requestRows || []) as SongRequestFinancials[]);

    try {
      const response = await fetch("/api/stripe/connect/payouts", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setPayoutInfo(await response.json());
      }
    } catch (error) {
      console.log("Payout info load error:", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  const completedRequests = requests.filter((request) =>
    COMPLETED_STATUSES.includes(request.request_status)
  );

  const grossValue = completedRequests.reduce(
    (total, request) => total + (request.request_amount ?? 0),
    0
  );

  const platformFees = completedRequests.reduce(
    (total, request) => total + (request.platform_fee ?? 0),
    0
  );

  const netEarnings = completedRequests.reduce(
    (total, request) => total + (request.dj_earnings ?? 0),
    0
  );

  const freeRequests = completedRequests.filter(
    (request) => request.plan_at_checkout !== "pro"
  );

  const proRequests = completedRequests.filter(
    (request) => request.plan_at_checkout === "pro"
  );

  const todayString = new Date().toDateString();

  const todaysRequests = requests.filter(
    (request) => new Date(request.created_at).toDateString() === todayString
  );

  const exportCsv = () => {
    const header = [
      "Date",
      "Song",
      "Artist",
      "Status",
      "Plan",
      "Gross Amount (£)",
      "Platform Fee (£)",
      "Net Earnings (£)",
    ];

    const rows = requests.map((request) => [
      new Date(request.created_at).toISOString(),
      request.song_title ?? "",
      request.artist ?? "",
      request.request_status,
      request.plan_at_checkout ?? "",
      ((request.request_amount ?? 0) / 100).toFixed(2),
      ((request.platform_fee ?? 0) / 100).toFixed(2),
      ((request.dj_earnings ?? 0) / 100).toFixed(2),
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `playing-next-earnings-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-white">
        <Card variant="elevated" className="p-8 text-center">
          <p className="text-sm text-zinc-400">Playing Next</p>
          <h1 className="mt-3 text-h2">Loading earnings...</h1>
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
            <h1 className="mt-2 text-h1">Earnings</h1>
            <p className="mt-2 text-zinc-400">
              Exactly how your earnings were calculated, request by request.
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Gross Request Value"
            value={formatPence(grossValue)}
            subtitle={`${completedRequests.length} accepted request${
              completedRequests.length !== 1 ? "s" : ""
            }`}
            icon={<PoundSterling size={20} />}
            tone="neutral"
          />

          <StatCard
            label="Platform Fees"
            value={formatPence(platformFees)}
            subtitle="Taken by Playing Next"
            icon={<Percent size={20} />}
            tone="warning"
          />

          <StatCard
            label="Net Earnings"
            value={formatPence(netEarnings)}
            subtitle="What you actually received"
            icon={<Wallet size={20} />}
            tone="accent"
          />

          <StatCard
            label="Available Balance"
            value={
              payoutInfo?.connected && payoutInfo.balance
                ? formatPence(payoutInfo.balance.available)
                : "—"
            }
            subtitle={
              payoutInfo?.connected && payoutInfo.balance
                ? `${formatPence(payoutInfo.balance.pending)} pending`
                : "Stripe not connected"
            }
            icon={<Clock size={20} />}
            tone="info"
          />
        </div>

        <p className="mt-4 text-sm text-zinc-500">
          Available Balance is your real Stripe balance, not a calculation —{" "}
          <span className="text-zinc-300">Available</span>{" "}
          is money that&apos;s cleared and ready to pay out to your bank,{" "}
          <span className="text-zinc-300">Pending</span>{" "}
          is recently captured money Stripe is still holding before release
          (standard for every Stripe account, usually a few days).
        </p>

        <Card variant="flat" className="mt-8 p-5 sm:p-6">
          <h2 className="text-h3">Free vs Pro Fee Breakdown</h2>

          <p className="mt-2 text-sm text-zinc-500">
            Which plan was active at the time each request was accepted —
            this stays accurate even if you switch plans later, since
            it&apos;s recorded per request rather than recalculated from your
            current plan.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-control border border-white/10 bg-zinc-950/60 p-5">
              <p className="font-semibold">Free plan requests</p>
              <p className="mt-1 text-sm text-zinc-500">
                {freeRequests.length} request
                {freeRequests.length !== 1 ? "s" : ""} · 15% platform fee
              </p>
              <p className="mt-3 text-2xl font-bold">
                {formatPence(
                  freeRequests.reduce(
                    (total, request) => total + (request.platform_fee ?? 0),
                    0
                  )
                )}
              </p>
              <p className="mt-1 text-xs text-zinc-500">fees paid</p>
            </div>

            <div className="rounded-control border border-white/10 bg-zinc-950/60 p-5">
              <p className="font-semibold">Pro plan requests</p>
              <p className="mt-1 text-sm text-zinc-500">
                {proRequests.length} request
                {proRequests.length !== 1 ? "s" : ""} · 0% platform fee
              </p>
              <p className="mt-3 text-2xl font-bold">£0.00</p>
              <p className="mt-1 text-xs text-zinc-500">fees paid</p>
            </div>
          </div>
        </Card>

        {payoutInfo?.connected && payoutInfo.payouts.length > 0 && (
          <Card variant="flat" className="mt-8 p-5 sm:p-6">
            <h2 className="text-h3">Recent Payouts</h2>

            <p className="mt-2 text-sm text-zinc-500">
              Straight from Stripe — when money actually left your balance
              for your bank account.
            </p>

            <div className="mt-6 space-y-3">
              {payoutInfo.payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex flex-col gap-2 rounded-control bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {formatPence(payout.amount)}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {new Date(payout.created * 1000).toLocaleDateString(
                        "en-GB"
                      )}
                    </p>
                  </div>

                  <Badge tone={payout.status === "paid" ? "accent" : "info"}>
                    {payout.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card variant="flat" className="mt-8 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-h3">Today&apos;s Transactions</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Older requests aren&apos;t shown here — export CSV for your
                full history.
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={exportCsv}
              disabled={requests.length === 0}
            >
              <Download size={16} className="mr-2" />
              Export CSV
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            {todaysRequests.length === 0 ? (
              <p className="text-zinc-400">No requests yet today.</p>
            ) : (
              todaysRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-2 rounded-control bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {request.song_title || "Untitled"}
                    </p>
                    <p className="truncate text-sm text-zinc-500">
                      {request.artist} ·{" "}
                      {new Date(request.created_at).toLocaleDateString(
                        "en-GB"
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-4 text-sm">
                    <span className="text-zinc-500">
                      {formatPence(request.request_amount ?? 0)} gross
                    </span>
                    <span className="font-semibold">
                      {formatPence(request.dj_earnings ?? 0)} net
                    </span>
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
