"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { REVEAL } from "./timings";

type Props = {
  children: ReactNode;
  /** Stagger index — multiplied by REVEAL.stagger for the delay. */
  index?: number;
  /** Extra delay in seconds, on top of the index stagger. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
};

/*
 * The single scroll-reveal gesture for the homepage.
 *
 * Every scene uses this rather than hand-rolling initial/whileInView,
 * so the whole page shares one arrival feel and retuning it is a
 * change in timings.ts. `once: true` matters both for performance and
 * because re-animating content someone scrolls back to is annoying.
 *
 * Under reduced motion this renders as a plain element with no
 * transform or opacity animation — the content is in the DOM and
 * visible either way, never gated behind an animation completing.
 */
export default function Reveal({
  children,
  index = 0,
  delay = 0,
  className,
  as = "div",
}: Props) {
  const shouldReduceMotion = useReducedMotion();
  const Component = motion[as];

  if (shouldReduceMotion) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: REVEAL.distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: REVEAL.viewportMargin }}
      transition={{
        duration: REVEAL.duration,
        ease: REVEAL.ease,
        delay: delay + index * REVEAL.stagger,
      }}
    >
      {children}
    </Component>
  );
}
