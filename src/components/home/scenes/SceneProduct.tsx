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
      className="relative z-10 px-5 py-24 sm:px-6 sm:py-32 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Everything in the booth
            </p>
          </Reveal>

          <Reveal index={1}>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Everything you need.
              <br />
              Nothing you don&apos;t.
            </h2>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {PRIMARY.map((item, index) => (
            <Reveal key={item.title} index={index}>
              <article className="group h-full rounded-card-lg border border-white/10 bg-surface-base/50 p-8 backdrop-blur-md transition duration-300 hover:border-accent/25 hover:bg-surface-base/80">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent transition duration-300 group-hover:scale-110">
                  <item.Icon size={22} />
                </div>

                <h3 className="mt-6 text-2xl font-bold tracking-tight">
                  {item.title}
                </h3>

                <p className="mt-3 leading-7 text-zinc-400">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SECONDARY.map((item, index) => (
            <Reveal key={item.title} index={index}>
              <article className="h-full rounded-card border border-white/10 bg-surface-base/40 p-6 backdrop-blur-md transition duration-300 hover:border-white/20">
                <item.Icon size={18} className="text-accent" />

                <h3 className="mt-4 font-bold">{item.title}</h3>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
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
