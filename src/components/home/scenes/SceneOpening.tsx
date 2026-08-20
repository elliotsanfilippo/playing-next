"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { Check, ChevronDown, Music2 } from "lucide-react";
import MoneyValue from "@/src/components/product/MoneyValue";
import { ACCEPT, PULLBACK } from "./timings";
import { transition } from "@/src/lib/motion";

type Props = {
  accepted: boolean;
  onAccept: () => void;
};

/** The request the visitor is invited to accept. Real track, real
 *  shape of data — the same fields a genuine request carries. */
const OPENING_REQUEST = {
  title: "Levels",
  artist: "Avicii",
  pence: 500,
};

/*
 * Scene 1 — the opening interaction, and the most important moment on
 * the page.
 *
 * Structure: this scene is `sticky` inside a taller wrapper, so
 * scrolling drives a "camera pull back" (scale + fade) that hands off
 * to the dashboard scene underneath. Clicking Accept plays the state
 * change and then scrolls, so both paths converge on the same
 * transition — the click is an invitation, never a gate. Nothing here
 * blocks the rest of the page: all content below is in the DOM and
 * reachable by scrolling straight past.
 */
export default function SceneOpening({ accepted, onAccept }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    [PULLBACK.scaleFrom, PULLBACK.scaleTo]
  );
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, PULLBACK.opacityTo]);
  const blur = useTransform(
    scrollYProgress,
    [0, 1],
    ["blur(0px)", `blur(${PULLBACK.blurTo}px)`]
  );

  /*
   * Reduced motion keeps the scene in normal document flow: no sticky
   * pinning, no scroll-linked transform. The card and its Accept
   * button still work — only the cinematic layer is dropped.
   */
  const cinematicStyle = shouldReduceMotion
    ? undefined
    : { scale, opacity, filter: blur };

  return (
    <div
      ref={wrapperRef}
      className={shouldReduceMotion ? undefined : "relative h-[190vh]"}
    >
      <motion.section
        style={cinematicStyle}
        className={
          shouldReduceMotion
            ? "relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-20"
            : "sticky top-0 flex h-screen items-center justify-center overflow-hidden px-5"
        }
      >
        {/* Ambient depth. Two slow-drifting blurred fields rather than a
            canvas or video — cheap, GPU-friendly, and enough to stop the
            dark background reading as a flat fill. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/3 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-green-500/12 blur-[130px]"
          animate={
            shouldReduceMotion
              ? undefined
              : { scale: [1, 1.12, 1], opacity: [0.55, 0.85, 0.55] }
          }
          transition={{
            duration: ACCEPT.ambientDurationSec,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-[12%] top-[22%] h-[26rem] w-[26rem] rounded-full bg-indigo-500/15 blur-[120px]"
          animate={
            shouldReduceMotion ? undefined : { x: [-24, 24, -24], y: [0, 18, 0] }
          }
          transition={{
            duration: ACCEPT.ambientDurationSec * 1.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <div className="relative z-10 w-full max-w-md">
          {/*
            The page's real heading. Visually hidden because the opening
            scene is deliberately wordless — the interface does the
            talking — but crawlers and screen readers still need a
            proper description of what this page is.
          */}
          <h1 className="sr-only">
            Playing Next — accept paid song requests from your crowd and
            stay in control of your set
          </h1>

          <motion.p
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: ACCEPT.cardEntranceDuration,
              delay: ACCEPT.cardEntranceDelay * 0.5,
            }}
            className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500"
          >
            A request just came in
          </motion.p>

          {/* The request card. Deliberately close to the real product's
              request presentation so the visitor is looking at the
              actual interface, not a marketing illustration. */}
          <motion.div
            initial={
              shouldReduceMotion
                ? false
                : { opacity: 0, y: 28, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: ACCEPT.cardEntranceDuration,
              delay: ACCEPT.cardEntranceDelay,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative overflow-hidden rounded-card-lg border border-white/15 bg-surface-raised/80 p-6 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
          >
            {/* Accent wash that intensifies once accepted. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent"
              animate={{ opacity: accepted ? 1 : 0 }}
              transition={transition.state}
            />

            <div className="relative flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500">
                <Music2 size={22} className="text-white" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  New request
                </p>
                {/* Interface content, not a document heading — the page's
                    real h1 is the visually-hidden one below. */}
                <p className="mt-1 truncate text-2xl font-bold">
                  {OPENING_REQUEST.title}
                </p>
                <p className="truncate text-sm text-zinc-400">
                  {OPENING_REQUEST.artist}
                </p>
              </div>

              <MoneyValue
                pence={OPENING_REQUEST.pence}
                size="prominent"
                className="shrink-0 text-accent"
              />
            </div>

            <div className="relative mt-6">
              <motion.button
                type="button"
                onClick={onAccept}
                disabled={accepted}
                aria-label={
                  accepted
                    ? "Request accepted"
                    : `Accept the request for ${OPENING_REQUEST.title} by ${OPENING_REQUEST.artist}`
                }
                whileHover={shouldReduceMotion || accepted ? undefined : { scale: 1.02 }}
                whileTap={shouldReduceMotion || accepted ? undefined : { scale: 0.98 }}
                transition={ACCEPT.confirmSpring}
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
                    transition={ACCEPT.confirmSpring}
                    className="flex items-center gap-2"
                  >
                    <Check size={20} strokeWidth={3} />
                    Accepted
                  </motion.span>
                ) : (
                  "Accept Request"
                )}
              </motion.button>

              {/* Expanding confirmation ring on accept. */}
              {accepted && !shouldReduceMotion && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-card border-2 border-accent"
                  initial={{ opacity: 0.7, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.14 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              )}
            </div>

            <p
              aria-live="polite"
              className="relative mt-4 text-center text-xs text-zinc-500"
            >
              {accepted
                ? "Added to your queue. This is Playing Next."
                : "You're the DJ. It's your call."}
            </p>
          </motion.div>

          {/* Scroll affordance — makes explicit that clicking is an
              invitation, not a requirement. */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: accepted ? 0 : 1 }}
            transition={{ delay: accepted ? 0 : 1.6, duration: 0.6 }}
            className="mt-10 flex flex-col items-center gap-2 text-zinc-600"
          >
            <span className="text-[11px] uppercase tracking-[0.2em]">
              or scroll to explore
            </span>
            <motion.span
              animate={shouldReduceMotion ? undefined : { y: [0, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown size={18} />
            </motion.span>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
