"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check, Music2, QrCode, Search } from "lucide-react";
import MoneyValue from "@/src/components/product/MoneyValue";
import StatusBadge from "@/src/components/product/StatusBadge";
import Reveal from "./Reveal";
import { GUEST } from "./timings";
import { SPRING, transition } from "@/src/lib/motion";

/*
 * The guest journey, mirroring the real flow in
 * app/request/[djSlug]: scan the QR, search a track, pick it, send the
 * request, then watch its status change as the DJ responds.
 *
 * Statuses here are the real database values ("pending", "accepted"),
 * rendered through the shared StatusBadge, so the wording and colour a
 * visitor sees is exactly what a real guest sees.
 */
const STEPS = [
  { id: "scan", label: "Scan" },
  { id: "search", label: "Search" },
  { id: "send", label: "Send" },
  { id: "status", label: "Status" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function SceneGuest() {
  const shouldReduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: false, margin: "-25%" });

  const [step, setStep] = useState<StepId>("scan");

  /*
   * The walkthrough only advances while the scene is actually on
   * screen — no timers running against an off-screen section, and the
   * visitor always arrives at the start of the story rather than
   * partway through it.
   */
  useEffect(() => {
    if (!inView || shouldReduceMotion) return;

    const order: StepId[] = STEPS.map((s) => s.id);
    let index = order.indexOf(step);

    const id = setInterval(() => {
      index = (index + 1) % order.length;
      setStep(order[index]);
    }, GUEST.stepHoldMs);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, shouldReduceMotion]);

  return (
    <section
      ref={sectionRef}
      className="relative z-10 px-5 py-24 sm:px-6 sm:py-32 lg:px-8"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_0.9fr]">
        <div className="min-w-0 lg:order-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              The other side
            </p>
          </Reveal>

          <Reveal index={1}>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Your crowd requests
              <br />
              in seconds.
            </h2>
          </Reveal>

          <Reveal index={2}>
            <p className="mt-5 max-w-md text-lg leading-8 text-zinc-400">
              They scan your QR code, find the track and send it
              straight to your booth. No app to download, no account to
              create.
            </p>
          </Reveal>

          <Reveal index={3}>
            <ol className="mt-8 space-y-3">
              {STEPS.map((s) => {
                const isActive = s.id === step;
                return (
                  <li key={s.id} className="flex items-center gap-3">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${
                        isActive ? "bg-accent" : "bg-zinc-700"
                      }`}
                    />
                    <span
                      className={`text-sm font-semibold transition-colors duration-300 ${
                        isActive ? "text-white" : "text-zinc-500"
                      }`}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Reveal>
        </div>

        {/* Phone frame. Mobile-first by construction: this is a real
            narrow-viewport layout, not a desktop UI shrunk down. */}
        <Reveal index={1} className="min-w-0 lg:order-1">
          <div className="relative mx-auto w-full max-w-[19rem]">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 rounded-full bg-green-500/10 blur-[100px]"
            />

            <div className="relative overflow-hidden rounded-[2.25rem] border border-white/15 bg-surface-raised/80 p-3 shadow-[0_35px_80px_-20px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
              <div
                aria-hidden
                className="mx-auto mb-3 h-1 w-16 rounded-full bg-white/15"
              />

              <div className="relative min-h-[23rem] rounded-[1.6rem] bg-canvas/80 p-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={transition.state}
                    className="flex h-full flex-col"
                  >
                    {step === "scan" && <GuestScanStep />}
                    {step === "search" && <GuestSearchStep />}
                    {step === "send" && <GuestSendStep />}
                    {step === "status" && (
                      <GuestStatusStep shouldReduceMotion={shouldReduceMotion} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StepHeading({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
      {children}
    </p>
  );
}

function GuestScanStep() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white p-3 text-black">
        <QrCode size={64} strokeWidth={1.5} />
      </div>
      <p className="mt-5 text-base font-bold">Scan to request a song</p>
      <p className="mt-1 text-sm text-zinc-500">ELSAN &middot; Live now</p>
    </div>
  );
}

function GuestSearchStep() {
  const results = [
    { title: "Levels", artist: "Avicii" },
    { title: "Wake Me Up", artist: "Avicii" },
    { title: "Hey Brother", artist: "Avicii" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <StepHeading>Find a track</StepHeading>

      <div className="mt-3 flex items-center gap-2 rounded-control border border-white/10 bg-black/50 px-3 py-2.5">
        <Search size={15} className="shrink-0 text-zinc-500" />
        <span className="text-sm text-white">Levels</span>
      </div>

      <div className="mt-3 space-y-2">
        {results.map((track, index) => (
          <div
            key={track.title}
            className={`flex items-center gap-3 rounded-control p-2.5 ${
              index === 0
                ? "border border-accent/30 bg-accent/[0.08]"
                : "border border-transparent"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500">
              <Music2 size={15} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{track.title}</p>
              <p className="truncate text-xs text-zinc-500">{track.artist}</p>
            </div>
            {index === 0 && (
              <Check size={16} className="shrink-0 text-accent" strokeWidth={3} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GuestSendStep() {
  return (
    <div className="flex flex-1 flex-col">
      <StepHeading>Your request</StepHeading>

      <div className="mt-3 rounded-control border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500">
            <Music2 size={18} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">Levels</p>
            <p className="truncate text-xs text-zinc-500">Avicii</p>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between text-zinc-400">
          <span>Song request</span>
          <MoneyValue pence={500} />
        </div>
        <div className="flex items-center justify-between text-zinc-400">
          <span>Service fee</span>
          <MoneyValue pence={50} compact={false} />
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-2 font-bold text-white">
          <span>Total</span>
          <MoneyValue pence={550} compact={false} />
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="flex h-12 items-center justify-center rounded-control bg-accent-strong text-sm font-bold text-black">
          Send request
        </div>
        <p className="mt-2 text-center text-[10px] text-zinc-600">
          You&apos;re only charged if the DJ accepts
        </p>
      </div>
    </div>
  );
}

function GuestStatusStep({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div
        initial={shouldReduceMotion ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.soft}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent"
      >
        <Check size={30} strokeWidth={3} />
      </motion.div>

      <p className="mt-5 text-lg font-bold">Request accepted</p>
      <p className="mt-1 text-sm text-zinc-500">Levels &middot; Avicii</p>

      <div className="mt-5">
        <StatusBadge status="accepted" audience="guest" />
      </div>

      <p className="mt-5 text-xs text-zinc-600">
        You&apos;re #4 in the queue
      </p>
    </div>
  );
}
