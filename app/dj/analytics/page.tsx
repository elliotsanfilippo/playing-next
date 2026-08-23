"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { supabase } from "../../../src/lib/supabase";
import { PRO_MONTHLY_PRICE_GBP } from "@/src/lib/pricing";
import {
  DEFAULT_RANGE,
  MIN_ROWS_FOR_RATE,
  hourLabel,
  rangeSentence,
  rangeSince,
  summariseAnalytics,
  summariseTips,
  type AnalyticsRow,
  type RangeKey,
} from "@/src/lib/analytics";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Skeleton from "@/src/components/ui/Skeleton";
import MoneyValue from "@/src/components/product/MoneyValue";
import RangePicker from "./components/RangePicker";
import RankedList from "./components/RankedList";
import HourChart from "./components/HourChart";
import { Section, SectionTitle, Proportion } from "./components/Section";

/*
 * Analytics answers "what are my guests asking me for, and what do I do
 * about it". It is not a financial page — /dj/earnings owns money — and
 * it is not a live page — the dashboard owns tonight.
 *
 * Every number on it comes from src/lib/analytics.ts. There is no
 * arithmetic in this file on purpose: the rules about which rows count
 * are subtle enough that they need to live somewhere testable, and a
 * page that computes its own figures is a page that can quietly disagree
 * with the one next to it.
 */

type TipBehaviour = { status: string; dj_earnings: number | null; created_at: string };

export default function AnalyticsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isActivePro, setIsActivePro] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);

  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [tips, setTips] = useState<TipBehaviour[]>([]);
  const [tipsFailed, setTipsFailed] = useState(false);

  /*
   * Starts with an await and never sets state before one.
   *
   * The loading flag is owned by whatever triggered the load — the
   * initial useState, the range buttons, the retry button — rather than
   * being flipped inside here. Setting it at the top of this function
   * meant the effect below set state synchronously on mount, which is
   * the cascading-render pattern React lints against.
   */
  const fetchAnalytics = useCallback(async (selected: RangeKey) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("dj_profiles")
      .select("id, plan, stripe_subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();

    /*
     * Unknown is not zero. The old page logged the error, set loading
     * false and returned, leaving every figure at its initial state —
     * so a failed query rendered 0 requests, 0 accepted, 0% and £0.00
     * as though that were the DJ's history. Same lesson as the earnings
     * page in 99f71ec.
     */
    if (profileError || !profile) {
      console.log("Analytics profile load error:", profileError);
      setLoadError("We couldn't load your analytics.");
      setLoading(false);
      return;
    }

    const activePro =
      profile.plan === "pro" && profile.stripe_subscription_status === "active";

    setIsActivePro(activePro);

    if (!activePro) {
      setLoading(false);
      return;
    }

    /*
     * The range is a .gte() on the query, not a filter applied to a
     * lifetime array in the browser. At today's volume either would
     * work; only one of them still works when a busy DJ has five years
     * of requests, and adding ranges was the moment to get it right.
     *
     * Still one unbounded read per range for now. The scaling path, when
     * a DJ's 30-day window itself gets large, is a server-side aggregate
     * behind an authenticated route — not needed at this size, and not
     * worth the architecture until it is.
     */
    const since = rangeSince(selected);

    let query = supabase
      .from("song_requests")
      .select(
        "request_status, stripe_payment_intent_id, song_title, artist, spotify_track_id, request_type, is_vip, dj_earnings, created_at"
      )
      .eq("dj_profile_id", profile.id);

    if (since) query = query.gte("created_at", since);

    const { data: requests, error: requestsError } = await query;

    if (requestsError) {
      console.log("Analytics requests load error:", requestsError);
      setLoadError("We couldn't load your analytics.");
      setLoading(false);
      return;
    }

    setRows((requests || []) as AnalyticsRow[]);

    /*
     * Tips come through the service-role route because `tips` is
     * deny-all under RLS. It returns succeeded tips only and has no
     * range parameter, so the window is applied here — the volume is a
     * handful of rows per DJ, and giving a route shared with the
     * dashboard and earnings a new parameter for this page's benefit is
     * not a trade worth making.
     *
     * A tip failing to load is not a reason to fail the page. It is one
     * optional line about guest behaviour, so it degrades on its own.
     */
    setTipsFailed(false);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      try {
        const response = await fetch("/api/dj/tips", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!response.ok) throw new Error("tips");

        const payload = await response.json();
        setTips((payload.tips ?? []) as TipBehaviour[]);
      } catch (error) {
        console.log("Analytics tips load error:", error);
        setTipsFailed(true);
        setTips([]);
      }
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    /*
     * Same arrangement the earnings page settled on in 5A. Nothing here
     * writes state synchronously: fetchAnalytics opens with
     * `await supabase.auth.getUser()` and every setState after it runs
     * in a response handler. The rule cannot see through the await to
     * tell that apart from a synchronous write, so it is disabled with
     * the reason rather than worked around by restructuring the load
     * into a shape that reads worse.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnalytics(range);
  }, [fetchAnalytics, range]);

  /* Range changes and retries own the loading state, so the effect
   * above does not have to touch it. */
  const changeRange = (next: RangeKey) => {
    if (next === range) return;
    setLoading(true);
    setLoadError("");
    setRange(next);
  };

  const retry = () => {
    setLoading(true);
    setLoadError("");
    fetchAnalytics(range);
  };

  const upgradeToPro = async () => {
    if (subscribing) return;

    setSubscribing(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to start the Pro upgrade.");
      }

      window.location.href = result.url;
    } catch (error) {
      console.log("Analytics upgrade error:", error);
      setSubscribing(false);
    }
  };

  const summary = summariseAnalytics(rows);
  const since = rangeSince(range);
  const tipBehaviour = summariseTips(
    tips.filter((tip) => !since || tip.created_at >= since)
  );
  const when = rangeSentence(range);

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        Analytics
      </h1>

      <Button
        variant="secondary"
        className="h-11 shrink-0 px-4 text-[13px]"
        onClick={() => router.push("/dj/dashboard")}
      >
        Dashboard
      </Button>
    </div>
  );

  if (!loading && loadError) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
        <section className="mx-auto max-w-3xl">
          {header}

          <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-6 text-center">
            <h2 className="text-lg font-bold">{loadError}</h2>

            {/* Says what it is and what it is not. A DJ looking at a
                failed analytics page needs to know their history is
                fine, not wonder whether it vanished. */}
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-zinc-400">
              This is a loading problem, not a problem with your requests.
              Nothing has been lost.
            </p>

            <Button className="mt-4" onClick={retry}>
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
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-32 rounded-card" />
          <Skeleton className="mt-4 h-48 rounded-card" />
          <Skeleton className="mt-4 h-40 rounded-card" />
          <p className="sr-only" role="status">
            Loading your analytics
          </p>
        </div>
      </main>
    );
  }

  if (!isActivePro) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
        <section className="mx-auto max-w-3xl">
          {header}

          <Card variant="elevated" className="mt-4 p-6 text-center sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Lock size={24} />
            </div>

            <h2 className="mt-5 text-h2">Analytics is a Pro feature</h2>

            <p className="mx-auto mt-3 max-w-md text-zinc-400">
              See what your guests keep asking for, when they ask, and how
              often you say yes. Upgrade to Pro to unlock it, plus 0%
              platform fee on every accepted request.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button onClick={upgradeToPro} disabled={subscribing}>
                {subscribing
                  ? "Opening..."
                  : `Upgrade to Pro (£${PRO_MONTHLY_PRICE_GBP.toFixed(2)}/mo)`}
              </Button>

              <Link
                href="/plans"
                className="text-sm font-semibold text-zinc-400 underline underline-offset-4 hover:text-white"
              >
                Compare plans
              </Link>
            </div>
          </Card>
        </section>
      </main>
    );
  }

  const hasRequests = summary.submitted > 0;

  return (
    <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
      <section className="mx-auto max-w-3xl">
        {header}

        <div className="mt-4">
          <RangePicker value={range} onChange={changeRange} />
        </div>

        {/*
          ── 1. Overview ───────────────────────────────────────────────
          A sentence, not a row of tiles. The five equal StatCards gave
          "Total Requests" the same weight as the acceptance rate and
          answered nothing on their own; a DJ opening this page wants to
          know what happened, and that is a thing you can just say.
        */}
        <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-4 sm:p-6">
          {hasRequests ? (
            <>
              <p className="text-lg font-semibold leading-7 sm:text-xl sm:leading-8">
                Guests submitted{" "}
                <span className="text-accent">{summary.submitted}</span>{" "}
                request{summary.submitted === 1 ? "" : "s"} {when}.
                {summary.markedPlayed > 0 && (
                  <>
                    {" "}
                    You marked{" "}
                    <span className="text-accent">{summary.markedPlayed}</span>{" "}
                    as played.
                  </>
                )}
              </p>

              {summary.busiestHour !== null && (
                <p className="mt-2 text-[13px] leading-5 text-zinc-400">
                  Most of them arrived around{" "}
                  <span className="font-semibold text-zinc-200">
                    {hourLabel(summary.busiestHour)}
                  </span>
                  .
                </p>
              )}

              {summary.awaiting > 0 && (
                <p className="mt-2 text-[13px] leading-5 text-zinc-400">
                  {summary.awaiting} still waiting on you.
                </p>
              )}
            </>
          ) : (
            /* An account with nothing in it gets a sentence explaining
               what will show up, not a grid of zeros and a 0% rate. */
            <>
              <p className="text-lg font-semibold leading-7">
                No requests {when}.
              </p>
              <p className="mt-2 text-[13px] leading-5 text-zinc-400">
                Once guests start requesting, this page shows what they ask
                for, when they ask, and how often you say yes. Try a wider
                date range if you have taken requests before.
              </p>
            </>
          )}
        </div>

        {hasRequests && (
          <>
            {/* ── 2. Most requested ─────────────────────────────────── */}
            <Section
              title="Most requested"
              hint="Grouped by track, so two different songs with the same title stay apart."
            >
              <RankedList
                className="mt-3"
                unit="request"
                items={summary.topTracks.map((track) => ({
                  key: track.key,
                  title: track.title,
                  subtitle: track.artist,
                  count: track.count,
                }))}
              />

              {summary.topArtists.length > 0 && (
                <div className="mt-5 border-t border-white/5 pt-4">
                  <SectionTitle>Artist credits</SectionTitle>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    Counted per credit, so everyone named on a track gets
                    one. Features count the same as leads.
                  </p>

                  <RankedList
                    className="mt-3"
                    unit="credit"
                    items={summary.topArtists.map((artist) => ({
                      key: artist.name,
                      title: artist.name,
                      count: artist.count,
                    }))}
                  />
                </div>
              )}
            </Section>

            {/* ── 3. When guests request ────────────────────────────── */}
            {summary.hours.length > 0 && (
              <Section
                title="When guests request"
                hint="When requests were sent to you, in your timezone. Not when you played them."
              >
                <HourChart hours={summary.hours} />
              </Section>
            )}

            {/* ── 4. Your decisions ─────────────────────────────────── */}
            <Section
              title="Your decisions"
              hint="Requests you answered. Cancelled, expired and unanswered requests are not decisions, so they are not counted here."
            >
              {summary.decisions >= MIN_ROWS_FOR_RATE &&
              summary.acceptanceRate !== null ? (
                <>
                  <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                    {summary.acceptanceRate}%
                    <span className="ml-2 text-[13px] font-medium text-zinc-500">
                      accepted
                    </span>
                  </p>

                  <p className="mt-1.5 text-[13px] text-zinc-400">
                    {summary.acceptedOutcomes} accepted ·{" "}
                    {summary.declined} declined
                  </p>
                </>
              ) : (
                /* Under the threshold the counts are still true, so they
                   are shown. The percentage is not, so it is not. */
                <p className="mt-3 text-[13px] leading-5 text-zinc-400">
                  {summary.acceptedOutcomes} accepted,{" "}
                  {summary.declined} declined. Too few decisions {when} to
                  show a meaningful rate yet.
                </p>
              )}
            </Section>

            {/* ── 5. How guests use requests ────────────────────────── */}
            <Section title="How guests use requests">
              <div className="mt-3">
                <Proportion
                  label="Song request"
                  part={summary.songOnly}
                  whole={summary.submitted}
                  percent={
                    summary.songMessageRate === null
                      ? null
                      : 100 - summary.songMessageRate
                  }
                />

                <Proportion
                  label="Song + Message"
                  part={summary.songMessage}
                  whole={summary.submitted}
                  percent={summary.songMessageRate}
                />
              </div>

              {/* VIP is an add-on that can sit on either type, so it gets
                  its own line rather than a third slice of the split
                  above, which would claim the three are alternatives. */}
              <div className="mt-4 border-t border-white/5 pt-3.5">
                <p className="text-[13px] text-zinc-300">
                  <span className="font-semibold text-white">
                    {summary.vip}
                  </span>{" "}
                  {summary.vip === 1 ? "request" : "requests"} paid for VIP
                  priority
                  {summary.vipRate !== null && (
                    <span className="text-zinc-500"> ({summary.vipRate}%)</span>
                  )}
                  .
                </p>
              </div>

              {/* Tips have no request_id in the schema, so nothing here
                  may suggest a tip belongs to a request or that one led
                  to the other. Standalone guest behaviour only. */}
              {tipBehaviour.count > 0 && (
                <div className="mt-3 border-t border-white/5 pt-3.5">
                  <p className="text-[13px] text-zinc-300">
                    <span className="font-semibold text-white">
                      {tipBehaviour.count}
                    </span>{" "}
                    {tipBehaviour.count === 1 ? "guest" : "guests"} left a tip
                    {tipBehaviour.averagePence !== null && (
                      <>
                        , averaging{" "}
                        <MoneyValue
                          pence={tipBehaviour.averagePence}
                          compact={false}
                          className="font-semibold text-zinc-200"
                        />
                      </>
                    )}
                    .
                  </p>
                </div>
              )}

              {tipsFailed && (
                <p role="status" className="mt-3 text-xs text-status-pending">
                  Tip activity couldn&apos;t be loaded.
                </p>
              )}
            </Section>

            {/* ── 6. From requests ──────────────────────────────────── */}
            <Section
              title="From requests"
              hint="What accepted requests were worth to you. Tips, balance and payouts live in Earnings."
            >
              <p className="mt-2.5">
                <MoneyValue
                  pence={summary.fromRequestsPence}
                  compact={false}
                  size="prominent"
                  className="font-bold text-white"
                />
              </p>

              <Link
                href="/dj/earnings"
                className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-accent underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                Full breakdown in Earnings
              </Link>
            </Section>
          </>
        )}
      </section>
    </main>
  );
}
