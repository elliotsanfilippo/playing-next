"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import Link from "next/link";
import { ArrowRight, Bell, Check, ChevronDown, Music2 } from "lucide-react";
import MoneyValue from "@/src/components/product/MoneyValue";
import Badge from "@/src/components/ui/Badge";
import { buttonVariants } from "@/src/components/ui/Button";
import { ACCEPT, ENTRANCE, PULLBACK } from "./timings";
import { SPRING, transition } from "@/src/lib/motion";
import {
  OPENING_REQUEST,
  OPENING_QUEUE,
  OPENING_PLAYING_NEXT,
} from "./storyData";
import { useIsDesktop } from "@/src/lib/useMediaQuery";

export type OpeningStage = "idle" | "accepted" | "landed";

/*
 * The compact dashboard shows the accepted request plus two more, so
 * the "N requests" label always matches the rows on screen — at three
 * rows the Playing Next block above still reads as the hierarchy,
 * which a longer list buries, especially on a phone.
 */
const OPENING_MINI_QUEUE = OPENING_QUEUE.slice(0, 2);

type Props = {
  stage: OpeningStage;
  onAccept: () => void;
};

/*
 * Scene 1 — the opening interaction.
 *
 * Runs a three-beat sequence, all of it inside this one viewport so it
 * never depends on scroll position landing somewhere specific:
 *
 *   idle     A request has arrived, but which song is deliberately
 *            withheld. The concept lands first: something came in, and
 *            it's yours to accept or not.
 *   accepted The song, artist and amount are revealed — the payoff for
 *            engaging, not a detail you'd already read.
 *   landed   The dashboard builds around the card, and the card itself
 *            scales down into the accepted queue while the queue makes
 *            room for it.
 *
 * The card→queue move is a real shared-element transition: the large
 * card and the queue row share one `layoutId`, so Motion morphs
 * position and size between them rather than crossfading two separate
 * elements. Both live in this component and only one is mounted at a
 * time, which is the case layoutId handles reliably.
 *
 * Once `landed`, it stays landed for the session — scrolling back up
 * returns to a completed dashboard, never a reset invitation.
 */
export default function SceneOpening({ stage, onAccept }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const isDesktop = useIsDesktop();
  const wrapperRef = useRef<HTMLDivElement>(null);

  /*
   * Gates the Accept button until the entrance has visually finished,
   * so it can never be clicked while still fading in. The timer is the
   * only stored state; the reduced-motion case is derived, since there
   * is no entrance to wait for in that branch.
   */
  const [entranceTimerElapsed, setEntranceTimerElapsed] = useState(false);
  const entranceDone = entranceTimerElapsed || Boolean(shouldReduceMotion);

  useEffect(() => {
    const id = window.setTimeout(
      () => setEntranceTimerElapsed(true),
      ENTRANCE.still * 1000
    );
    return () => window.clearTimeout(id);
  }, []);

  /*
   * The scroll-pinned pull-back is desktop-only. On a phone it fights
   * the platform: mobile browsers resize the viewport as the address
   * bar hides, which makes any vh-pinned, scroll-scrubbed scene jitter,
   * and a 175vh pinned section costs a phone user two full screens of
   * scrolling before the story starts. Mobile plays the same three
   * beats in normal document flow instead.
   */
  const cinematic = isDesktop && !shouldReduceMotion;

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    [PULLBACK.scaleFrom, PULLBACK.scaleTo]
  );
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, PULLBACK.opacityTo]);

  const cinematicStyle = cinematic ? { scale, opacity } : undefined;

  const revealed = stage !== "idle";

  return (
    <div
      ref={wrapperRef}
      className={cinematic ? "relative h-[175vh]" : undefined}
    >
      <motion.section
        style={cinematicStyle}
        className={
          cinematic
            ? "sticky top-0 flex h-screen items-center overflow-hidden px-5"
            : "relative overflow-hidden px-5 pb-14 pt-24 sm:pb-16 sm:pt-28"
        }
      >
        {/* Ambient depth — blurred gradient fields rather than canvas or
            video. Cheap, GPU-friendly, and enough to stop a dark
            background reading as a flat fill. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-[8%] top-1/4 h-[34rem] w-[34rem] rounded-full bg-green-500/12 blur-[130px]"
          animate={
            shouldReduceMotion
              ? undefined
              : { scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }
          }
          transition={{
            duration: ACCEPT.ambientDurationSec,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-[10%] top-[18%] h-[26rem] w-[26rem] rounded-full bg-indigo-500/15 blur-[120px]"
          animate={
            shouldReduceMotion ? undefined : { x: [-20, 20, -20], y: [0, 16, 0] }
          }
          transition={{
            duration: ACCEPT.ambientDurationSec * 1.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          {/* Hero messaging — restrained, present from first paint. */}
          <div className="min-w-0">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: ENTRANCE.copyDuration,
                delay: ENTRANCE.badgeAt,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Badge
                tone="accent"
                dot
                className="text-xs font-bold uppercase tracking-[0.18em]"
              >
                Built for working DJs
              </Badge>
            </motion.div>

            <motion.h1
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: ENTRANCE.copyDuration,
                delay: ENTRANCE.headlineAt,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-5 text-[2rem] font-bold leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:mt-6 lg:text-6xl"
            >
              Accept paid
              <br />
              song requests.
              <br />
              <span className="text-accent">Earn more every set.</span>
            </motion.h1>

            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: ENTRANCE.copyDuration,
                delay: ENTRANCE.subheadAt,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-4 max-w-md text-[0.95rem] leading-6 text-zinc-400 sm:text-lg sm:leading-8 lg:mt-6"
            >
              Your crowd pays to hear what they want. You decide what
              actually plays.
            </motion.p>

            {/* CTAs surface once the sequence has played out, so they
                don't compete with Accept Request for attention. */}
            <AnimatePresence>
              {stage === "landed" && (
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-8"
                >
                  <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                    Start free
                    <ArrowRight size={18} />
                  </Link>

                  <a
                    href="#find-dj"
                    className={buttonVariants({
                      variant: "secondary",
                      size: "lg",
                    })}
                  >
                    Find your DJ
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* The stage. Fixed minimum height so the layout never jumps
              as the card gives way to the dashboard. */}
          <div className="relative min-w-0 lg:min-h-[30rem]">
            <AnimatePresence mode="popLayout">
              {stage !== "landed" ? (
                <motion.div
                  key="request"
                  className="lg:absolute lg:inset-x-0 lg:top-1/2 lg:-translate-y-1/2"
                >
                  <OpeningRequestCard
                    revealed={revealed}
                    accepted={stage === "accepted"}
                    onAccept={onAccept}
                    shouldReduceMotion={shouldReduceMotion}
                    isDesktop={isDesktop}
                    entranceDone={entranceDone}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="dashboard"
                  initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <MiniDashboard shouldReduceMotion={shouldReduceMotion} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Scroll affordance — makes explicit that accepting is an
            invitation, not a toll gate. */}
        <motion.div
          aria-hidden
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: stage === "idle" ? 1 : 0 }}
          transition={{
            delay: stage === "idle" ? ENTRANCE.scrollHintAt : 0,
            duration: 0.6,
          }}
          className="absolute inset-x-0 bottom-8 hidden flex-col items-center gap-2 text-zinc-600 lg:flex"
        >
          <span className="text-[11px] uppercase tracking-[0.2em]">
            or scroll to explore
          </span>
          <ChevronDown size={18} />
        </motion.div>
      </motion.section>
    </div>
  );
}

/* ── The request card, idle → accepted ─────────────────────────── */

function OpeningRequestCard({
  revealed,
  accepted,
  onAccept,
  shouldReduceMotion,
  isDesktop,
  entranceDone,
}: {
  revealed: boolean;
  accepted: boolean;
  onAccept: () => void;
  shouldReduceMotion: boolean | null;
  isDesktop: boolean;
  entranceDone: boolean;
}) {
  const travel = isDesktop
    ? ENTRANCE.cardTravel
    : ENTRANCE.cardTravelMobile;

  /*
   * The arrival is applied to an outer wrapper rather than to the
   * layoutId element itself. Mixing an entrance transform into a
   * shared-element transition makes Motion fight itself over the same
   * transform when the card later morphs into the queue row — this
   * keeps the two concerns on separate elements.
   *
   * Only opacity and transform animate, so the card occupies its final
   * space from first paint and nothing reflows as it lands.
   */
  return (
    <motion.div
      initial={
        shouldReduceMotion
          ? false
          : { opacity: 0, y: travel, scale: ENTRANCE.cardScaleFrom }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...ENTRANCE.cardSpring, delay: ENTRANCE.cardAt }}
    >
    <motion.div
      layoutId="hero-request"
      transition={SPRING.soft}
      className="relative mx-auto max-w-md overflow-hidden rounded-card-lg border border-white/15 bg-surface-raised/80 p-5 sm:p-6 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent"
        animate={{ opacity: accepted ? 1 : 0 }}
        transition={transition.state}
      />

      <div className="relative flex items-center gap-3.5 sm:gap-4">
        <motion.div
          layout
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 sm:h-14 sm:w-14"
        >
          {revealed ? (
            <Music2 size={22} className="text-white" />
          ) : (
            <motion.span
              /* Reacts exactly once as the request lands. No repeat:
                 after the arrival the scene holds completely still. */
              initial={shouldReduceMotion ? false : { rotate: 0 }}
              animate={
                shouldReduceMotion ? undefined : { rotate: [0, -14, 10, -5, 0] }
              }
              transition={{
                duration: ENTRANCE.indicatorDuration,
                delay: ENTRANCE.indicatorAt,
                ease: "easeOut",
              }}
            >
              <Bell size={22} className="text-white" />
            </motion.span>
          )}

          {/* Single expanding ring, timed with the bell — the visual
              "ping" of a notification landing. Fires once. */}
          {!revealed && !shouldReduceMotion && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-white/50"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.65, 0], scale: [1, 1.35, 1.5] }}
              transition={{
                duration: ENTRANCE.indicatorDuration,
                delay: ENTRANCE.indicatorAt,
                ease: "easeOut",
              }}
            />
          )}
        </motion.div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {revealed ? "Accepted request" : "New request"}
          </p>

          {/*
            The song is withheld until acceptance — the concept lands
            first, the specifics are the reward for engaging.

            Both states are always in the DOM and crossfaded rather
            than swapped through AnimatePresence mode="wait". That mode
            blocks the incoming element until the outgoing one's exit
            finishes, so an interrupted or throttled animation can
            leave the card with no song text at all. Crossfading also
            keeps the real title readable to screen readers and
            crawlers throughout.
          */}
          <div className="relative mt-1 min-h-[3rem] sm:min-h-[3.25rem]">
            <motion.div
              animate={{ opacity: revealed ? 0 : 1 }}
              transition={transition.state}
              aria-hidden={revealed}
              className="absolute inset-x-0 top-0"
            >
              <p className="text-xl font-bold sm:text-2xl">Someone wants a song</p>
              <p className="text-sm text-zinc-400">
                Accept it to step inside Playing Next
              </p>
            </motion.div>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{
                opacity: revealed ? 1 : 0,
                y: revealed ? 0 : 8,
              }}
              transition={transition.state}
              aria-hidden={!revealed}
              className="absolute inset-x-0 top-0"
            >
              <p className="truncate text-xl font-bold sm:text-2xl">
                {OPENING_REQUEST.title}
              </p>
              <p className="truncate text-sm text-zinc-400">
                {OPENING_REQUEST.artist}
              </p>
            </motion.div>
          </div>
        </div>

        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING.tight}
              className="shrink-0"
            >
              <MoneyValue
                pence={OPENING_REQUEST.pence}
                size="prominent"
                className="text-accent"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        className="relative mt-5 sm:mt-6"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: ENTRANCE.acceptDuration,
          delay: ENTRANCE.acceptAt,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <motion.button
          type="button"
          onClick={onAccept}
          /* Not clickable until the entrance has visually finished. */
          disabled={accepted || !entranceDone}
          aria-label={
            accepted
              ? "Request accepted"
              : "Accept the incoming song request"
          }
          whileHover={
            shouldReduceMotion || accepted || !entranceDone
              ? undefined
              : { scale: 1.02 }
          }
          whileTap={
            shouldReduceMotion || accepted || !entranceDone
              ? undefined
              : { scale: 0.98 }
          }
          transition={SPRING.tight}
          className={`flex h-14 w-full items-center justify-center gap-2 rounded-card text-base font-bold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
            accepted
              ? "bg-accent text-black"
              : "bg-accent-strong text-black shadow-[0_0_40px_-8px_rgba(74,222,128,0.55)] hover:brightness-110"
          }`}
        >
          {accepted ? (
            <motion.span
              initial={shouldReduceMotion ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.soft}
              className="flex items-center gap-2"
            >
              <Check size={20} strokeWidth={3} />
              Accepted
            </motion.span>
          ) : (
            "Accept Request"
          )}
        </motion.button>

        {accepted && !shouldReduceMotion && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-card border-2 border-accent"
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 1.14 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        )}
      </motion.div>

      <p
        aria-live="polite"
        className="relative mt-4 text-center text-xs text-zinc-500"
      >
        {accepted
          ? `${OPENING_REQUEST.title} added to your queue.`
          : "You're the DJ. It's your call."}
      </p>
    </motion.div>
    </motion.div>
  );
}

/* ── The dashboard the card lands in ───────────────────────────── */

function MiniDashboard({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null;
}) {
  return (
    <div className="relative rounded-card-lg border border-white/15 bg-surface-raised/70 p-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-5">
      {/* Header strip, mirroring the real dashboard's identity + status */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-blue-500" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Good evening
            </p>
            <p className="text-sm font-bold">Your dashboard</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Taking Requests
        </span>
      </div>

      {/* Playing Next sits above the queue, matching the real product */}
      <div className="mt-4 rounded-2xl border border-accent/15 bg-accent/[0.06] p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Playing next
        </p>

        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500">
            <Music2 size={17} className="text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {OPENING_PLAYING_NEXT.title}
            </p>
            <p className="truncate text-xs text-zinc-500">
              {OPENING_PLAYING_NEXT.artist}
            </p>
          </div>

          <motion.span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full bg-accent"
            animate={
              shouldReduceMotion
                ? undefined
                : { opacity: [1, 0.35, 1], scale: [1, 0.85, 1] }
            }
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Accepted queue
        </p>
        <p className="text-[11px] text-zinc-600">
          {OPENING_MINI_QUEUE.length + 1} requests
        </p>
      </div>

      {/* The queue makes room: existing rows shift down via layout
          animation as the accepted card lands in position 1. */}
      <motion.div layout className="mt-2.5 space-y-2">
        <motion.div
          layoutId="hero-request"
          transition={SPRING.soft}
          className="overflow-hidden rounded-card border border-accent/30 bg-accent/[0.06] p-2.5"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-xs font-bold tabular-nums text-accent">
              1
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {OPENING_REQUEST.title}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {OPENING_REQUEST.artist}
              </p>
            </div>

            <MoneyValue
              pence={OPENING_REQUEST.pence}
              className="shrink-0 text-zinc-400"
            />

            <motion.span
              initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...SPRING.tight, delay: 0.35 }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-black"
            >
              <Check size={12} strokeWidth={3} />
            </motion.span>
          </div>
        </motion.div>

        {OPENING_MINI_QUEUE.map((track, index) => (
          <motion.div
            key={track.id}
            layout
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.soft, delay: 0.1 + index * 0.06 }}
            className="rounded-card border border-white/5 bg-surface-base/60 p-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-bold tabular-nums text-zinc-400">
                {index + 2}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{track.title}</p>
                <p className="truncate text-xs text-zinc-500">{track.artist}</p>
              </div>

              <MoneyValue pence={track.pence} className="shrink-0 text-zinc-400" />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
