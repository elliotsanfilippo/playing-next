"use client";

import { motion, useReducedMotion } from "motion/react";
import Reveal from "./Reveal";
import { REVEAL } from "./timings";

/*
 * The practical explainer, kept from the previous homepage because it
 * answers a question the cinematic scenes deliberately don't: what do
 * *I* actually have to do to get started.
 *
 * Positioned after the story rather than replacing any of it — by this
 * point a visitor understands the product and is asking about setup,
 * so this reads as an answer rather than an introduction. Kept
 * deliberately compact: five short steps, no illustrations, no
 * per-step animation beyond the connecting line.
 */
const STEPS = [
  {
    number: "01",
    title: "Create your account",
    description: "Set up your DJ profile in minutes.",
  },
  {
    number: "02",
    title: "Connect Stripe",
    description: "Securely receive payments and payouts.",
  },
  {
    number: "03",
    title: "Display your QR",
    description: "Share it at your venue, party or event.",
  },
  {
    number: "04",
    title: "Manage requests",
    description: "Stay in control of what enters your queue.",
  },
  {
    number: "05",
    title: "Get paid",
    description: "Accepted requests are captured automatically.",
  },
];

export default function SceneHowItWorks() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="how-it-works"
      className="relative z-10 px-5 py-14 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Start in minutes
            </p>
          </Reveal>

          <Reveal index={1}>
            <h2 className="mt-3 text-[1.75rem] font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
          </Reveal>
        </div>

        {/*
          Two genuinely different compositions, not one squeezed to fit.

          On desktop this is five centred cards in a row with a
          horizontal line running through them. Stacking that same
          treatment on a phone produced five tall boxes with a big
          centred medallion each, ~180px apiece, for one short line of
          text — a lot of scrolling that read as a desktop grid folded
          up rather than something designed for the screen.

          At phone widths it is instead a compact numbered list: the
          step number sits in the left rail, the text runs beside it,
          and a vertical line threads the numbers together. Same five
          steps, same information, about a third of the height.
        */}
        <div className="relative mt-9 grid grid-cols-1 gap-y-5 md:mt-10 md:grid-cols-5 md:gap-4">
          {/* The rail. Horizontal across the desktop row, vertical down
              the phone list — drawn once as the section enters view. */}
          <motion.div
            aria-hidden
            className="absolute left-[10%] right-[10%] top-7 hidden h-px origin-left bg-gradient-to-r from-transparent via-green-500/60 to-transparent md:block"
            initial={shouldReduceMotion ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: REVEAL.viewportMargin }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />

          <motion.div
            aria-hidden
            className="absolute bottom-6 left-[1.375rem] top-6 w-px origin-top bg-gradient-to-b from-transparent via-green-500/40 to-transparent md:hidden"
            initial={shouldReduceMotion ? false : { scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: REVEAL.viewportMargin }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />

          {STEPS.map((step, index) => (
            <Reveal key={step.number} index={index}>
              <article className="relative flex h-full items-start gap-4 text-left md:flex-col md:items-stretch md:gap-0 md:p-2 md:text-center">
                {/* Opaque fill, so the rail passes behind the numbers
                    rather than through them. */}
                <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-[#0b130e] text-sm font-bold text-accent shadow-lg shadow-green-500/10 md:mx-auto md:h-14 md:w-14">
                  {step.number}
                </div>

                <div className="min-w-0 flex-1 md:flex-none">
                  <h3 className="font-bold md:mt-4">{step.title}</h3>

                  <p className="mt-1 text-sm leading-6 text-zinc-500 md:mt-1.5">
                    {step.description}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
