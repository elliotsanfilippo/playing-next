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
      className="relative z-10 px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Start in minutes
            </p>
          </Reveal>

          <Reveal index={1}>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
          </Reveal>
        </div>

        <div className="relative mt-10 grid gap-3 sm:grid-cols-2 md:grid-cols-5 md:gap-4">
          {/* Connecting line, drawn once as the section enters view.
              Desktop only — with five stacked cards on a phone there's
              no horizontal run for it to trace. */}
          <motion.div
            aria-hidden
            className="absolute left-[10%] right-[10%] top-7 hidden h-px origin-left bg-gradient-to-r from-transparent via-green-500/60 to-transparent md:block"
            initial={shouldReduceMotion ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: REVEAL.viewportMargin }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />

          {STEPS.map((step, index) => (
            <Reveal key={step.number} index={index}>
              <article className="relative h-full rounded-card border border-white/10 bg-surface-base/40 p-5 text-center backdrop-blur-md md:border-0 md:bg-transparent md:p-2 md:backdrop-blur-none">
                <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-[#0b130e] text-sm font-bold text-accent shadow-lg shadow-green-500/10">
                  {step.number}
                </div>

                <h3 className="mt-4 font-bold">{step.title}</h3>

                <p className="mt-1.5 text-sm leading-6 text-zinc-500">
                  {step.description}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
