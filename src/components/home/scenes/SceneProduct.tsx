"use client";

import {
  PoundSterling,
  ListMusic,
  QrCode,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Reveal from "./Reveal";

/*
 * Scene 6 — the concise product overview, once the story has already
 * done the explaining.
 *
 * Deliberately editorial rather than six identical icon cards: two
 * emphasised items carry the headline capabilities at a larger size,
 * and the remaining four sit in a tighter supporting grid. The visual
 * weight difference is what stops this reading as a generic feature
 * wall.
 */
const PRIMARY = [
  {
    Icon: PoundSterling,
    title: "Paid requests, your prices",
    body: "Set what a request costs. Guests authorise on submit and are only charged when you accept.",
  },
  {
    Icon: ListMusic,
    title: "A queue you actually control",
    body: "Accept, decline with a reason, reorder, and mark what's playing next. Nothing lands without you.",
  },
];

const SECONDARY = [
  { Icon: QrCode, title: "One QR code", body: "Cards, booth signs and a lock-screen wallpaper, ready to print." },
  { Icon: Radio, title: "Venue display", body: "A screen showing what's playing and what's next." },
  { Icon: ShieldCheck, title: "Stripe payouts", body: "Paid straight to your own connected account." },
  { Icon: Sparkles, title: "VIP & tips", body: "Priority slots and tips, on top of request income." },
];

export default function SceneProduct() {
  return (
    <section
      id="features"
      className="relative z-10 px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Everything in the booth
            </p>
          </Reveal>

          <Reveal index={1}>
            <h2 className="mt-3 text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              Everything you need.
              <br />
              Nothing you don&apos;t.
            </h2>
          </Reveal>
        </div>

        {/* Two rows, each internally uniform: the hierarchy is the
            row, not the individual card. Every card in a row shares a
            height via items-stretch + h-full, so the difference reads
            as intent rather than as cards that failed to line up. */}
        <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2">
          {PRIMARY.map((item, index) => (
            <Reveal key={item.title} index={index} className="h-full">
              <article className="group flex h-full flex-col rounded-card-lg border border-white/10 bg-surface-base/50 p-6 backdrop-blur-md transition duration-300 hover:border-accent/25 hover:bg-surface-base/80 sm:p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent transition duration-300 group-hover:scale-110">
                  <item.Icon size={22} />
                </div>

                <h3 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">
                  {item.title}
                </h3>

                <p className="mt-2.5 leading-7 text-zinc-400">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-4 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECONDARY.map((item, index) => (
            <Reveal key={item.title} index={index} className="h-full">
              <article className="flex h-full flex-col rounded-card border border-white/10 bg-surface-base/40 p-5 backdrop-blur-md transition duration-300 hover:border-white/20">
                <item.Icon size={18} className="text-accent" />

                <h3 className="mt-3.5 font-bold">{item.title}</h3>

                <p className="mt-1.5 text-sm leading-6 text-zinc-500">
                  {item.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
