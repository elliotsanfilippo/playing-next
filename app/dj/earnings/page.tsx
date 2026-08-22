"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Banknote } from "lucide-react";
import { supabase } from "../../../src/lib/supabase";
import ScrollList from "@/src/components/ui/ScrollList";
import Button from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import Badge from "@/src/components/ui/Badge";
import MoneyValue from "@/src/components/product/MoneyValue";
import EarningsTransactionRow from "@/src/components/dj/EarningsTransactionRow";
import {
  summariseEarnings,
  buildTransactions,
  buildEarningsCsv,
  isToday,
  FREE_FEE_PERCENT,
  PRO_FEE_PERCENT,
  type RequestRow,
  type TipRow,
} from "@/src/lib/earnings";

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

function formatPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function EarningsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<SongRequestFinancials[]>([]);
  const [tips, setTips] = useState<TipRow[]>([]);
  /* Non-fatal. Requests loaded, so the page still renders honestly and
     says the tip figure is missing rather than quietly omitting it. */
  const [tipsFailed, setTipsFailed] = useState(false);
  /*
   * A failed load used to set loading=false and return, leaving
   * requests=[] — so the page rendered £0.00 across every figure as
   * though the DJ had genuinely earned nothing that night. A DJ cannot
   * tell that apart from a quiet gig. Nothing is shown as a number until
   * we know the number is real.
   */
  const [loadError, setLoadError] = useState("");
  const [payoutInfo, setPayoutInfo] = useState<PayoutsResponse | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  /*
   * `showSpinner` is false on the mount call: `loading` already starts
   * true, so setting it again synchronously inside the effect is a
   * cascading render for no benefit. A manual retry does want it, since
   * by then the page is showing an error rather than a spinner.
   */
  const fetchEarnings = async (showSpinner = true) => {
    /* Both writes are skipped on the mount call: `loading` already starts
       true and `loadError` already starts empty, so writing them again
       synchronously inside the effect is a cascading render for nothing.
       A retry does want both, since by then an error is on screen. */
    if (showSpinner) {
      setLoading(true);
      setLoadError("");
    }

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
      setLoadError("We couldn't load your earnings.");
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
          is_vip,
          request_type,
          created_at
        `
      )
      .eq("dj_profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (requestsError) {
      console.log("Earnings requests load error:", requestsError);
      setLoadError("We couldn't load your earnings.");
      setLoading(false);
      return;
    }

    setRequests((requestRows || []) as SongRequestFinancials[]);

    /*
     * Tips were never fetched here, so every figure on this page
     * excluded them and understated a DJ's income by their entire tip
     * total. Read through the service-role route: `tips` has no RLS
     * policy for the DJ's own session.
     */
    setTipsFailed(false);

    try {
      const tipResponse = await fetch("/api/dj/tips", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (tipResponse.ok) {
        const payload = await tipResponse.json();
        setTips((payload.tips ?? []) as TipRow[]);
      } else {
        setTipsFailed(true);
      }
    } catch (error) {
      console.log("Tips load error:", error);
      setTipsFailed(true);
    }

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

  const handleWithdraw = async () => {
    if (withdrawing) return;

    const amountInPence = Math.round(Number(withdrawAmount) * 100);

    if (!Number.isFinite(amountInPence) || amountInPence <= 0) {
      toast.error("Enter a valid amount to withdraw.");
      return;
    }

    setWithdrawing(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/stripe/connect/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amount: amountInPence }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to withdraw right now.");
      }

      toast.success(`Withdrawal of ${formatPence(amountInPence)} started.`);
      setWithdrawAmount("");
      await fetchEarnings();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to withdraw right now."
      );
    } finally {
      setWithdrawing(false);
    }
  };


  useEffect(() => {
    /*
     * Mount-only bootstrap. fetchEarnings is recreated every render, so
     * listing it as a dependency would refetch on every state change.
     *
     * eslint-disable set-state-in-effect: with showSpinner false there is
     * no synchronous write left — the first statement that touches state
     * comes after `await supabase.auth.getSession()`, so every setState
     * happens in a response handler. The rule cannot see through the
     * await to tell that apart from a synchronous write.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEarnings(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * One accounting basis, shared with the CSV so an export cannot
   * disagree with the screen it came from. See src/lib/earnings.ts for
   * why disputed money is surfaced separately rather than folded into
   * the headline, and why VIP is a count rather than an amount.
   */
  const summary = summariseEarnings(requests as RequestRow[], tips);
  const transactions = buildTransactions(requests as RequestRow[], tips);
  const todaysTransactions = transactions.filter((t) => isToday(t.createdAt));

  const exportCsv = () => {
    /*
     * Built from the same transaction list the page renders, so the file
     * reconciles with the screen. The old export pulled raw request rows
     * separately, included cancelled/declined/expired with their pricing
     * snapshots as though they were income, omitted tips entirely, and
     * stamped dates in UTC while the page grouped by local day.
     */
    const csv = buildEarningsCsv(transactions);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    /* Local date, matching the dates inside the file. */
    link.download = `playing-next-earnings-${new Date().toLocaleDateString("en-CA")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /*
   * Shown instead of the figures, never alongside them. An error banner
   * above a page of £0.00 totals still leaves the zeros there to be
   * misread as a quiet night.
   */
  if (!loading && loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-5 text-white">
        <div className="w-full max-w-sm rounded-card border border-white/10 bg-surface-raised p-6 text-center">
          <h1 className="text-lg font-bold">{loadError}</h1>
          <p className="mt-2 text-[13px] leading-5 text-zinc-500">
            This is a loading problem, not a change to your earnings.
            Nothing has been lost.
          </p>
          <Button className="mt-5 w-full" onClick={() => fetchEarnings()}>
            Try again
          </Button>
          <Button
            variant="secondary"
            className="mt-2.5 w-full"
            onClick={() => router.push("/dj/dashboard")}
          >
            Back to dashboard
          </Button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <div className="h-40 animate-pulse rounded-card bg-white/5 motion-reduce:animate-none" />
          <div className="mt-4 h-24 animate-pulse rounded-card bg-white/5 motion-reduce:animate-none" />
          <div className="mt-4 h-64 animate-pulse rounded-card bg-white/5 motion-reduce:animate-none" />
          <p className="sr-only" role="status">
            Loading your earnings
          </p>
        </div>
      </main>
    );
  }

  const hasEarned = summary.totalEarned > 0;

  return (
    <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
      <section className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Earnings
          </h1>

          <Button
            variant="secondary"
            className="h-11 shrink-0 px-4 text-[13px]"
            onClick={() => router.push("/dj/dashboard")}
          >
            Dashboard
          </Button>
        </div>

        {/*
          ── 1. Earned ─────────────────────────────────────────────────
          The figure a DJ opened this page for, first and largest, with
          nothing above it to scroll past. Requests and tips are one
          number because that is the question ("what am I making?"), and
          the split sits underneath so it stays honest.
        */}
        <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Earned
          </p>

          <p className="mt-1.5">
            <MoneyValue
              pence={summary.totalEarned}
              compact={false}
              className="text-money text-accent"
            />
          </p>

          <p className="mt-2 text-[13px] leading-5 text-zinc-400">
            {hasEarned ? (
              <>
                <MoneyValue
                  pence={summary.fromRequests}
                  compact={false}
                  className="font-semibold text-zinc-200"
                />{" "}
                from {summary.earningRequestCount} request
                {summary.earningRequestCount === 1 ? "" : "s"}
                {summary.tipCount > 0 && (
                  <>
                    {" · "}
                    <MoneyValue
                      pence={summary.fromTips}
                      compact={false}
                      className="font-semibold text-zinc-200"
                    />{" "}
                    from {summary.tipCount} tip
                    {summary.tipCount === 1 ? "" : "s"}
                  </>
                )}
              </>
            ) : (
              "Money from accepted requests and tips appears here as soon as a DJ set gets going."
            )}
          </p>

          {tipsFailed && (
            <p role="status" className="mt-2 text-xs text-status-pending">
              Tips couldn&apos;t be loaded, so they aren&apos;t included in
              this figure.
            </p>
          )}

          {/* Today, on exactly the same basis as the dashboard's Tonight
              strip — both now use the viewer's clock for requests and
              tips alike. */}
          <div className="mt-4 flex items-baseline gap-2 border-t border-white/5 pt-3.5">
            <span className="text-[13px] text-zinc-500">Today</span>
            <MoneyValue
              pence={summary.todayTotal}
              compact={false}
              className="text-base font-bold text-white"
            />
            {summary.todayFromTips > 0 && (
              <span className="text-xs text-zinc-500">
                incl.{" "}
                <MoneyValue
                  pence={summary.todayFromTips}
                  compact={false}
                  className="text-zinc-400"
                />{" "}
                tips
              </span>
            )}
          </div>
        </div>

        {/*
          ── 2. Where it came from ─────────────────────────────────────
          Deliberately not four equal stat cards. These are supporting
          facts about one figure, so they read as a list.
        */}
        {hasEarned && (
          <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
            <h2 className="text-sm font-bold tracking-tight">
              Where it came from
            </h2>

            <dl className="mt-3 space-y-2.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-zinc-400">
                  Song requests
                  {summary.vipRequestCount > 0 && (
                    /*
                     * A count, not an amount. request_amount bundles the
                     * base price and the VIP uplift with no column
                     * preserving the split, so any VIP figure would be
                     * today's VIP price applied backwards over rows that
                     * may have been bought at another one.
                     */
                    <span className="text-zinc-600">
                      {" "}
                      · {summary.vipRequestCount} VIP
                    </span>
                  )}
                </dt>
                <dd>
                  <MoneyValue
                    pence={summary.fromRequests}
                    compact={false}
                    className="font-semibold text-white"
                  />
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-zinc-400">Tips</dt>
                <dd>
                  <MoneyValue
                    pence={summary.fromTips}
                    compact={false}
                    className="font-semibold text-white"
                  />
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-4 border-t border-white/5 pt-2.5">
                <dt className="text-zinc-500">
                  Playing Next kept
                  <span className="block text-xs text-zinc-600">
                    {summary.proRequestCount > 0 && summary.freeRequestCount === 0
                      ? `${PRO_FEE_PERCENT}% on Pro`
                      : `${FREE_FEE_PERCENT}% on Free plan requests`}
                  </span>
                </dt>
                <dd className="text-zinc-400">
                  <MoneyValue pence={summary.platformFees} compact={false} />
                </dd>
              </div>

              {/*
                Surfaced rather than folded in. A disputed charge was
                captured, so the DJ did receive it — but the cardholder's
                bank is trying to take it back, and quietly counting it
                would let the headline figure drop later with no
                explanation.
              */}
              {summary.atRiskCount > 0 && (
                <div className="flex items-baseline justify-between gap-4 border-t border-white/5 pt-2.5">
                  <dt className="text-status-declined">
                    Under dispute
                    <span className="block text-xs text-zinc-500">
                      Not counted above while the bank reviews it
                    </span>
                  </dt>
                  <dd className="text-status-declined">
                    <MoneyValue pence={summary.atRisk} compact={false} />
                  </dd>
                </div>
              )}

              {summary.reversedCount > 0 && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-zinc-500">
                    Refunded
                    <span className="block text-xs text-zinc-600">
                      Returned to the guest, not counted above
                    </span>
                  </dt>
                  <dd className="text-zinc-500">
                    <MoneyValue pence={summary.reversed} compact={false} />
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/*
          ── 3. Your balance ───────────────────────────────────────────
          Deliberately its own section with its own words. Earned is what
          the gigs made; balance is what Stripe is holding; a payout is
          what reached the bank. Those are three different numbers and
          conflating them is how a DJ ends up thinking money is missing.
        */}
        {payoutInfo?.connected && payoutInfo.balance && (
          <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Banknote size={15} aria-hidden className="text-accent" />
              <h2 className="text-sm font-bold tracking-tight">Your balance</h2>
            </div>

            <p className="mt-1 text-xs text-zinc-500">
              Held by Stripe from your earnings. Not the same as earned:
              money arrives here after each request is accepted, and
              leaves when it&apos;s paid to your bank.
            </p>

            <div className="mt-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  Available
                </p>
                <MoneyValue
                  pence={payoutInfo.balance.available}
                  compact={false}
                  className="text-xl font-bold text-white"
                />
              </div>

              {payoutInfo.balance.pending > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    Still clearing
                  </p>
                  <MoneyValue
                    pence={payoutInfo.balance.pending}
                    compact={false}
                    className="text-xl font-bold text-zinc-400"
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="withdraw-amount"
                  className="text-xs font-semibold text-zinc-300"
                >
                  Withdraw to your bank (£)
                </label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                  disabled={withdrawing || payoutInfo.balance.available === 0}
                  className="mt-1.5"
                />
              </div>

              <Button
                className="h-14 sm:w-auto sm:px-6"
                onClick={handleWithdraw}
                aria-busy={withdrawing}
                disabled={
                  withdrawing ||
                  payoutInfo.balance.available === 0 ||
                  !withdrawAmount
                }
              >
                {withdrawing ? "Starting..." : "Withdraw"}
              </Button>
            </div>
          </div>
        )}

        {/* ── 4. Paid out ──────────────────────────────────────────── */}
        {payoutInfo?.connected && payoutInfo.payouts.length > 0 && (
          <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
            <h2 className="text-sm font-bold tracking-tight">Paid out</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Straight from Stripe: money that actually left your balance
              for your bank account.
            </p>

            <ul className="mt-3.5 space-y-2">
              {payoutInfo.payouts.map((payout) => (
                <li
                  key={payout.id}
                  className="flex items-center justify-between gap-3 rounded-control border border-white/5 bg-surface-base/60 p-3"
                >
                  <div className="min-w-0">
                    <MoneyValue
                      pence={payout.amount}
                      compact={false}
                      className="text-sm font-bold text-white"
                    />
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {new Date(payout.created * 1000).toLocaleDateString(
                        "en-GB"
                      )}
                    </p>
                  </div>

                  <Badge tone={payout.status === "paid" ? "accent" : "info"}>
                    {payout.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── 5. Transactions ──────────────────────────────────────── */}
        <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold tracking-tight">Today</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Everything from today. Export for your full history.
              </p>
            </div>

            <Button
              variant="secondary"
              className="h-11 shrink-0 px-4 text-[13px]"
              onClick={exportCsv}
              disabled={transactions.length === 0}
            >
              <Download size={15} aria-hidden />
              Export CSV
            </Button>
          </div>

          {/*
            Contained scroll, the same treatment Recent Activity uses on
            the dashboard: the heading and Export stay put while the rows
            scroll, so a busy night cannot stretch this page. max-h is a
            cap only — a quiet day keeps its natural height and shows no
            scrollbar.
          */}
          <ScrollList
            maxHeightClassName="max-h-80 sm:max-h-[26rem]"
            className="mt-3.5 space-y-2 pr-1"
          >
            {todaysTransactions.length === 0 ? (
              <p className="px-1 py-6 text-center text-[13px] text-zinc-500">
                Nothing today yet.
              </p>
            ) : (
              todaysTransactions.map((transaction) => (
                <EarningsTransactionRow
                  key={`${transaction.kind}-${transaction.id}`}
                  transaction={transaction}
                />
              ))
            )}
          </ScrollList>
        </div>
      </section>
    </main>
  );
}
