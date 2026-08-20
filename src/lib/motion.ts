import type { Transition, Variants } from "motion/react";

/*
 * Playing Next motion system.
 *
 * Mirrors the --duration-* / --ease-* tokens in app/globals.css so CSS
 * transitions and Framer animations share one vocabulary. Import these
 * instead of writing literal durations per component — the point is a
 * recognisable motion personality, which you only get if the same
 * gesture takes the same time everywhere.
 *
 * Tier guide:
 *   micro      — hover, press, toggles. Should feel instant.
 *   state      — a thing changed meaning: accept/decline, status swap.
 *   structural — layout moved: queue reorder, panels, page sections.
 *   cinematic  — marketing storytelling only. Never in the DJ product,
 *                where a slow animation is a slow tool.
 */

export const DURATION = {
  micro: 0.14,
  state: 0.28,
  structural: 0.52,
  cinematic: 0.9,
} as const;

/*
 * Tuples, not arrays, because Framer's `ease` prop is typed as a
 * fixed-length bezier. `outSoft` decelerates hard — good for things
 * arriving. `springSoft` overshoots slightly — good for things that
 * should feel physical (a card landing, a number popping).
 */
export const EASE = {
  outSoft: [0.22, 1, 0.36, 1] as const,
  springSoft: [0.34, 1.4, 0.64, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
};

/*
 * Spring presets for things that should feel physical rather than
 * timed. Prefer these for anything the user directly caused (accepting
 * a request, dragging, pressing) — springs absorb interruption
 * gracefully, where a fixed-duration tween restarts and looks broken.
 */
export const SPRING = {
  /** Snappy, minimal overshoot — buttons, small state changes. */
  tight: { type: "spring", stiffness: 420, damping: 32 } as const,
  /** Noticeable settle — cards landing, items entering a queue. */
  soft: { type: "spring", stiffness: 260, damping: 26 } as const,
  /** Slow, heavy — large surfaces, sheets, structural movement. */
  heavy: { type: "spring", stiffness: 160, damping: 24 } as const,
};

export const transition = {
  micro: { duration: DURATION.micro, ease: EASE.outSoft } satisfies Transition,
  state: { duration: DURATION.state, ease: EASE.outSoft } satisfies Transition,
  structural: {
    duration: DURATION.structural,
    ease: EASE.outSoft,
  } satisfies Transition,
  cinematic: {
    duration: DURATION.cinematic,
    ease: EASE.outSoft,
  } satisfies Transition,
};

/*
 * Shared variants. `fadeUp` is the default "this arrived" gesture used
 * across marketing scroll reveals and product empty/loading states.
 * Distance is deliberately small (12px): past ~16px a fade reads as a
 * slide, which draws attention to the motion instead of the content.
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: transition.state },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.state },
};

/*
 * Container for staggered children. Framer resolves `staggerChildren`
 * against children that declare matching variant names, so children
 * must use the same "hidden"/"visible" keys (fadeUp above does).
 */
export function staggerContainer(
  stagger = 0.06,
  delayChildren = 0
): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

/*
 * Standard viewport config for scroll-triggered reveals. `once` matters
 * for perf and for not re-animating content a user scrolls back to;
 * the negative margin delays the trigger until the element is properly
 * on screen rather than firing at the very edge.
 */
export const scrollReveal = {
  initial: "hidden",
  whileInView: "visible",
  viewport: { once: true, margin: "-80px" },
} as const;
