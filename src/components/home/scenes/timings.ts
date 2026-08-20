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
  /* Copy settles first: badge, then headline, then subheading. Tight
     overlaps — the copy is supporting cast here, not the event. */
  badgeAt: 0.04,
  headlineAt: 0.11,
  subheadAt: 0.19,
  copyDuration: 0.42,

  /* Dead air between the copy settling (~0.61s) and the request
     landing. Short, but non-zero on purpose: without a gap the card
     reads as part of the page load rather than as something that just
     came in. This is the beat to lengthen if the arrival ever stops
     feeling like an event. */
  pause: 0.19,

  /* ── The notification arrival ─────────────────────────────────── */
  cardAt: 0.8,

  /** Travel in px. Mobile is reduced — identical distance on a small
   *  screen reads as the card flying in from off-canvas. */
  cardTravel: 26,
  cardTravelMobile: 16,

  /*
   * Scale is keyframed rather than sprung so the overshoot is exact.
   * A spring's overshoot is a proportion of its travel, and over a
   * scale delta this small it's imperceptible — you'd have to drop
   * damping far enough that the *position* starts wobbling too, which
   * is where it turns cartoony. Explicit keyframes give one clean pop
   * and one settle, independent of the y spring.
   */
  cardScaleKeyframes: [0.88, 1.025, 1] as number[],
  cardScaleTimes: [0, 0.58, 1] as number[],
  cardScaleDuration: 0.44,

  /** Position spring. Near-critically damped (zeta ~0.95) so y snaps
   *  in without adding a second wobble on top of the scale pop. */
  cardSpring: { type: "spring", stiffness: 520, damping: 34, mass: 0.85 } as const,

  /** Opacity leads slightly so the card is legible as it travels. */
  cardFadeDuration: 0.2,

  /** One-shot red glow behind the card as it lands, then gone.
   *  Duration is set so the glow has fully faded by `still` — nothing
   *  should still be moving when the button becomes clickable. */
  arrivalGlowDuration: 0.54,
  arrivalGlowPeak: 0.55,

  /* ── Attention + action ───────────────────────────────────────── */

  /** The indicator reacts once, overlapping the card's settle tail so
   *  the two read as a single event rather than two beats. Short on
   *  purpose: a notification ping is a flick, not a shake, and it also
   *  has to be finished by `still`. */
  indicatorAt: 0.94,
  indicatorDuration: 0.4,

  /** Accept arrives right behind the reaction. */
  acceptAt: 1.0,
  acceptDuration: 0.3,

  /** Everything still. This is the number to move if the opening ever
   *  feels slow or rushed — but keep it at or above the last thing to
   *  come to rest (currently the indicator and glow, both at ~1.34s),
   *  so the button never becomes clickable mid-motion. */
  still: 1.35,

  /** Scroll affordance last, and static once shown. */
  scrollHintAt: 1.6,
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
