import { EASE, SPRING } from "@/src/lib/motion";

/*
 * ── HOMEPAGE TUNING DIAL ──────────────────────────────────────────
 *
 * Every timing, delay and easing the cinematic homepage uses lives
 * here, so tuning the feel after watching it in a real browser is a
 * one-file edit rather than a hunt through eight scene components.
 *
 * Motion cannot be verified in the dev preview environment (it runs
 * the page with visibilityState "hidden", which suspends
 * requestAnimationFrame), so these values are considered a starting
 * point, not a finished result.
 *
 * Rough guide to what to reach for:
 *   "feels sluggish"        → lower ACCEPT.* and REVEAL.duration
 *   "too twitchy/jumpy"     → raise REVEAL.duration, soften SPRING
 *   "reveals fire too early"→ make REVEAL.viewportMargin more negative
 *   "too much movement"     → lower REVEAL.distance toward 0
 */

/*
 * Scene 1 entrance — the "a request just arrived" choreography.
 *
 * Reads as a notification landing rather than a card that was already
 * sitting there: the page settles first, pauses, then the request
 * arrives with one spring and stops. Every value is a start time in
 * seconds from first paint, so the order is readable top to bottom and
 * retiming is arithmetic rather than guesswork.
 *
 * To retune:
 *   snappier    → scale every `at` down (try x0.7) and raise the
 *                 spring stiffness in ENTRANCE.cardSpring
 *   softer      → raise `settle` and lower cardSpring stiffness
 *   more drama  → lengthen `pause`, raise cardTravel, lower stiffness
 *
 * There is deliberately no looping motion on the card after `still` —
 * once the request has landed the scene holds completely still and
 * waits for the visitor.
 */
export const ENTRANCE = {
  /** Copy settles first: badge, then headline, then subheading. */
  badgeAt: 0.06,
  headlineAt: 0.16,
  subheadAt: 0.28,
  copyDuration: 0.62,

  /** Dead air before the request lands. This beat is what makes the
   *  card read as *arriving* rather than fading in with the page. */
  pause: 0.34,

  /** The request card itself. */
  cardAt: 1.18,
  /** Travel distance in px. Mobile uses the reduced value — the same
   *  distance on a small screen reads as the card flying in. */
  cardTravel: 30,
  cardTravelMobile: 18,
  cardScaleFrom: 0.965,

  /** One spring settle, no overshoot loop. Lower damping = more
   *  visible settle; below ~24 it starts to read as a bounce. */
  cardSpring: { type: "spring", stiffness: 260, damping: 28, mass: 0.9 } as const,

  /** The status dot reacts once, shortly after the card lands. */
  indicatorAt: 1.42,
  indicatorDuration: 0.85,

  /** Accept becomes available a beat after the card, so it reads as
   *  the next step rather than arriving with it. */
  acceptAt: 1.52,
  acceptDuration: 0.42,

  /** Everything is still from here. Used to enable the button, so it
   *  can never be clicked before it's visually available. */
  still: 1.94,

  /** Scroll affordance comes last and does not move afterwards. */
  scrollHintAt: 2.3,
} as const;

/** Scene 1: the Accept Request interaction — the hero moment. */
export const ACCEPT = {

  /** Pause on "Accepted" before the camera pulls back, in ms.
   *  This is the beat that makes the click feel satisfying — too
   *  short and the confirmation is missed, too long and it drags. */
  holdAfterAcceptMs: 900,

  /** The confirmation state change itself. */
  confirmSpring: SPRING.soft,

  /** Ambient background drift. Very slow on purpose: perceptible
   *  only if you look for it, never distracting. */
  ambientDurationSec: 14,
} as const;

/*
 * Scene 1 → 2 "camera pull back", driven by scroll progress rather
 * than a timer so it stays tied to the user's own movement. These are
 * the start/end scale and opacity of the opening scene as it recedes.
 */
export const PULLBACK = {
  scaleFrom: 1,
  scaleTo: 0.9,
  opacityTo: 0,
  /** Blur (px) at full pull-back. 0 disables — it's the most
   *  expensive part of this transition on low-end devices. */
  blurTo: 4,
} as const;

/** Standard scroll-triggered reveal used by scenes 2-7. */
export const REVEAL = {
  duration: 0.55,
  /** Travel distance in px. Small is deliberate: past ~20px a fade
   *  reads as a slide and draws attention to the motion. */
  distance: 16,
  /** Delay between staggered siblings. */
  stagger: 0.08,
  ease: EASE.outSoft,
  /** How far into the viewport before firing. More negative = later. */
  viewportMargin: "-90px",
} as const;

/** Scene 5: the earnings counter. */
export const EARNINGS = {
  /** Count-up duration in seconds. */
  countDurationSec: 1.6,
  /** Delay before contributing amounts fly into the total. */
  contributorDelay: 0.3,
  contributorStagger: 0.12,
} as const;

/** Scene 4: the guest phone walkthrough. */
export const GUEST = {
  /** How long each step of the guest flow holds before advancing. */
  stepHoldMs: 2100,
  stepSpring: SPRING.soft,
} as const;
