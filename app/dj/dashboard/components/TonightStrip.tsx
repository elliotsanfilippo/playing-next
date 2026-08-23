"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, useReducedMotion } from "motion/react";
import { ChevronRight, Heart } from "lucide-react";
import { cn } from "@/src/lib/cn";

type Props = {
  /** Live state: awaiting a decision right now, at any age. */
  pendingCount: number;
  /** Live state: sitting in the queue right now, at any age. */
  queueCount: number;
  /** Tonight's local day, the same basis as the two figures below. */
  playedCount: number;
  /** Tonight's request earnings, in pounds. */
  tonightRevenue: number;
  /** Tonight's succeeded tips, in pounds. */
  tipsToday: number;
  /** Resolved by the dashboard through isProEntitled, so trialing and
   *  past_due read as Pro here exactly as they do at every other gate. */
  isPro: boolean;
};

/*
 * Replaces the five equal stat tiles.
 *
 * Those gave the same visual weight to "Played: 11" as to what the
 * night has earned, and on a phone their 2-column grid took three rows.
 * Here earnings lead, because that is the question the dashboard should
 * answer without navigation, and the counts are one line of secondary
 * text. They stay anchor links to their sections, which is behaviour
 * the old tiles had.
 *
 * No breakdown, no chart, no trend. /dj/earnings exists for that; this
 * is a live tool and the figure is the answer, not the start of an
 * analysis.
 */
export default function TonightStrip({
  pendingCount,
  queueCount,
  playedCount,
  tonightRevenue,
  tipsToday,
  isPro,
}: Props) {
  const shouldReduceMotion = useReducedMotion();

  /*
   * The figure counts up only when it changes while the DJ is watching,
   * and only upward. On first paint it is simply correct — animating
   * from zero on every load would turn a fact into a performance. A
   * downward change (a refund, a decline) resolves instantly, because
   * counting money down deserves no flourish.
   */
  const [shown, setShown] = useState(tonightRevenue);
  const previous = useRef(tonightRevenue);

  useEffect(() => {
    const from = previous.current;
    previous.current = tonightRevenue;

    if (from === tonightRevenue) return;

    if (shouldReduceMotion || tonightRevenue < from) {
      setShown(tonightRevenue);
      return;
    }

    const controls = animate(from, tonightRevenue, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (value) => setShown(value),
    });

    return () => controls.stop();
  }, [tonightRevenue, shouldReduceMotion]);

  const counts = [
    { label: "pending", value: pendingCount, href: "#pending-requests" },
    { label: "queued", value: queueCount, href: "#accepted-queue" },
    { label: "played", value: playedCount, href: "#history" },
  ];

  return (
    <section
      aria-label="Tonight so far"
      className="rounded-card border border-white/10 bg-surface-raised/70 px-4 py-3.5 sm:p-5"
    >
      {/*
        The eyebrow row carries the plan marker in the space opposite it,
        which was empty. Deliberately not inside the Taking Requests
        control above: that row is what a DJ reaches for mid-set, and
        account metadata has no business sharing it.

        Pulled out of the left column so the badge can sit at the far
        right without the money figure moving. The row's height is the
        eyebrow's, and the badge's padding is cancelled by a matching
        negative margin, so nothing below it shifts by a pixel.
      */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Tonight
        </p>

        <Link
          href="/plans"
          /* The whole label is the accessible name, so the visible word
             is aria-hidden rather than being read twice as
             "Free You are on the Free plan". */
          aria-label={
            isPro
              ? "You are on the Pro plan. View plans and billing."
              : "You are on the Free plan. View plans."
          }
          /* -my-3.5 py-3.5: a 47px hit area inside a 19px row. The
             negative margin cancels the padding exactly, so the target
             is thumb-sized and the card is not a pixel taller. Same
             trick the counts below use. */
          className={cn(
            "-my-3.5 flex shrink-0 items-center gap-0.5 rounded py-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
            isPro
              ? "text-accent hover:text-accent-strong"
              : /* zinc-400, not zinc-500. Understated was the brief, but
                   zinc-500 measured 4.29:1 against this card and AA is
                   not negotiable for a word carrying account state. At
                   10px, uppercase and widely tracked, it still reads as
                   metadata rather than as something to act on. */
                "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "rounded-full px-1.5 py-0.5",
              /* Pro gets a whisper of the accent. Free gets nothing but
                 the word, so it recedes into the interface rather than
                 reading as a state the DJ should act on. */
              isPro && "bg-accent/10"
            )}
          >
            {isPro ? "Pro" : "Free"}
          </span>

          <ChevronRight size={11} aria-hidden />
        </Link>
      </div>

      {/*
        mt-0.5 rather than mt-1. The Pro pill's own vertical padding
        makes the eyebrow row 19px where the bare eyebrow was 17px, so
        this gives the two pixels back and the card measures exactly what
        it did before the badge existed. Verified against the pre-change
        component side by side: 125px and 125px.
      */}
      <div className="mt-0.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-2.5">
            {/*
              The visible figure is not the live region.

              It used to be, and the claim in this comment used to be
              that it announced the settled value. It did the opposite:
              animate()'s onUpdate calls setShown once per frame, so a
              single accept rewrote the live region roughly forty times
              in 0.7s. On a busy night that is an announcement storm on
              its own, before any other state change is considered.

              The count-up is decoration, so it is now aria-hidden, and
              a separate visually hidden region carries the settled
              target value. It updates once per real change.
            */}
            <span aria-hidden className="text-money text-accent">
              £{shown.toFixed(2)}
            </span>

            <span aria-live="polite" aria-atomic="true" className="sr-only">
              Tonight so far £{tonightRevenue.toFixed(2)}
            </span>

            {/*
              Tips sit beside the figure, not inside it, and only when
              there are any. They are a separate revenue stream in the
              data model — the tips table has no request reference — so
              folding them into the request total, or attaching them to
              a song, would be a claim the data cannot support.
            */}
            {tipsToday > 0 && (
              <span className="flex items-center gap-1 text-sm font-semibold text-pink-300">
                <Heart size={13} className="shrink-0" />
                <span className="tabular-nums">£{tipsToday.toFixed(2)}</span>
                <span className="text-zinc-500">tips</span>
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm sm:gap-5">
          {counts.map((count) => (
            <a
              key={count.label}
              href={count.href}
              /*
               * The visible text is 24px tall, which is right for a
               * secondary count but well under a usable touch target.
               * Vertical padding plus a matching negative margin gives
               * a 44px hit area while the row's layout height is
               * unchanged — the alternative, making them physically
               * taller, would have pushed this strip from 127px to
               * ~147px to fix a problem the DJ cannot see.
               */
              className="group -my-2.5 flex items-baseline gap-1.5 rounded py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span className="text-base font-bold tabular-nums text-white group-hover:text-accent">
                {count.value}
              </span>
              <span className="text-zinc-500">{count.label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
