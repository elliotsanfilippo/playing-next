"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  ListMusic,
  PoundSterling,
  QrCode,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Reveal from "./Reveal";
import { REVEAL } from "./timings";

/*
 * Scene 6 — the concise product overview, once the story has already
 * done the explaining.
 *
 * One uniform grid, not a mixed-size editorial layout. Every card
 * shares the same padding, radius, icon size, heading size and
 * internal rhythm; only the body copy length varies, and the grid
 * equalises height per row so bottoms align regardless.
 *
 * The cards are `motion.article` used directly as grid children rather
 * than each being wrapped in <Reveal>. That wrapper was the actual
 * cause of the uneven heights: it inserted a plain div between the
 * grid and the card, so `items-stretch` stretched the wrapper while
 * the card inside sized to its own content. With the article as the
 * grid item, stretch applies to the card itself.
 */
const FEATURES = [
  {
    Icon: PoundSterling,
    title: "Paid requests",
    body: "Set your price. Guests authorise on submit and are only charged when you accept.",
  },
  {
    Icon: ListMusic,
    title: "A queue you control",
    body: "Accept, decline with a reason, reorder, and set what's playing next.",
  },
  {
    Icon: QrCode,
    title: "One QR code",
    body: "Table cards, booth signs and a lock-screen wallpaper, ready to print.",
  },
  {
    Icon: Radio,
    title: "Venue display",
    body: "A screen for the room showing what's playing and what's coming up.",
  },
  {
    Icon: ShieldCheck,
    title: "Stripe payouts",
    body: "Paid straight into your own connected Stripe account.",
  },
  {
    Icon: Sparkles,
    title: "VIP and tips",
    body: "Priority slots and tips from the floor, on top of request income.",
  },
];

export default function SceneProduct() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="features"
      className="relative z-10 px-5 py-14 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        {/* Marketing heading block: centred, matching the other
            storytelling sections. */}
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Everything in the booth
            </p>
          </Reveal>

          <Reveal index={1}>
            <h2 className="mt-3 text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              Everything you need.
              <br />
              Nothing you don&apos;t.
            </h2>
          </Reveal>
        </div>

        {/*
          auto-rows-fr starts at sm. It exists to equalise the height of
          cards sitting side by side in a row, which is a multi-column
          problem — applied to the single-column phone layout it stretched
          every card to the height of the wordiest one, leaving six tall
          boxes padded out with empty space. In one column each card
          sizes to its own content.
        */}
        <div className="mt-9 grid grid-cols-1 gap-3 sm:mt-10 sm:auto-rows-fr sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {FEATURES.map((item, index) => (
            <motion.article
              key={item.title}
              initial={
                shouldReduceMotion
                  ? false
                  : { opacity: 0, y: REVEAL.distance }
              }
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: REVEAL.viewportMargin }}
              transition={{
                duration: REVEAL.duration,
                ease: REVEAL.ease,
                delay: index * REVEAL.stagger,
              }}
              /* Card content is product information, so it stays
                 left-aligned even though the section heading is centred. */
              className="group flex h-full flex-col rounded-card border border-white/10 bg-surface-base/50 p-5 text-left backdrop-blur-md transition-colors duration-300 hover:border-accent/25 hover:bg-surface-base/80 sm:p-6"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                <item.Icon size={20} />
              </div>

              <h3 className="mt-4 text-lg font-bold tracking-tight sm:mt-5">
                {item.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {item.body}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
