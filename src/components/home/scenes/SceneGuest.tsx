"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check, ChevronRight, Music2, QrCode, Search, User } from "lucide-react";
import MoneyValue from "@/src/components/product/MoneyValue";
import StatusBadge from "@/src/components/product/StatusBadge";
import Reveal from "./Reveal";
import { GUEST } from "./timings";
import { SPRING, transition } from "@/src/lib/motion";
import { GUEST_REQUEST, GUEST_SEARCH_RESULTS } from "./storyData";

/*
 * Scene 4 — the crowd's side.
 *
 * Mirrors the real guest flow in app/request/[djSlug]: land on the
 * DJ's page, search a track, review the amount, send, then watch the
 * status change. Statuses use the real database values through the
 * shared StatusBadge, so the wording and colour match what a guest
 * genuinely sees.
 *
 * The frame is deliberately phone-proportioned (roughly 9:19.5, the
 * modern handset ratio) rather than a squat rounded box — at shorter
 * ratios it reads as a watch and the interface inside has no room to
 * behave like a real screen.
 */
const STEPS = [
  { id: "scan", label: "Scan the QR" },
  { id: "search", label: "Find the track" },
  { id: "send", label: "Send the request" },
  { id: "status", label: "Track its status" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function SceneGuest() {
  const shouldReduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: false, margin: "-25%" });

  const [step, setStep] = useState<StepId>("scan");

  /*
   * Only advances while on screen — no timers running against an
   * off-screen section, and the visitor always arrives at the start of
   * the story rather than partway through it.
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
      className="relative z-10 px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.95fr] lg:gap-16">
        <div className="min-w-0 lg:order-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              The other side
            </p>
          </Reveal>

          <Reveal index={1}>
            <h2 className="mt-3 text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              Your crowd requests
              <br className="hidden sm:block" /> in seconds.
            </h2>
          </Reveal>

          <Reveal index={2}>
            <p className="mt-4 max-w-md text-[0.95rem] leading-6 text-zinc-400 sm:text-lg sm:leading-8">
              They scan your QR code, find the track and send it
              straight to your booth. No app to download, no account to
              create.
            </p>
          </Reveal>

          <Reveal index={3}>
            <ol className="mt-7 space-y-2.5">
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

        <Reveal index={1} className="min-w-0 lg:order-1">
          {/* Phone frame at a true handset ratio. */}
          <div className="relative mx-auto w-full max-w-[17rem] sm:max-w-[18.5rem]">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-10 rounded-full bg-green-500/10 blur-[100px]"
            />

            <div className="relative aspect-[9/19] overflow-hidden rounded-[2.5rem] border-[3px] border-white/15 bg-surface-raised/80 p-2.5 shadow-[0_35px_80px_-20px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
              {/* Notch / speaker bar */}
              <div
                aria-hidden
                className="absolute left-1/2 top-3 z-10 h-1.5 w-20 -translate-x-1/2 rounded-full bg-black/60"
              />

              <div className="relative h-full overflow-hidden rounded-[2rem] bg-canvas/90 px-4 pb-4 pt-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
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

/** Generic DJ avatar — a real guest lands on a profile with a photo,
 *  so an anonymous scan screen understates what they actually see. */
function DjAvatar({ size = "lg" }: { size?: "sm" | "lg" }) {
  const dimensions = size === "lg" ? "h-16 w-16" : "h-9 w-9";
  const iconSize = size === "lg" ? 28 : 16;

  return (
    <div
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white ring-2 ring-white/10`}
    >
      <User size={iconSize} strokeWidth={2.2} />
    </div>
  );
}

function GuestScanStep() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <DjAvatar />

      <p className="mt-4 text-base font-bold">ELSAN</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Taking requests
      </div>

      <div className="mt-6 rounded-2xl bg-white p-3 text-black">
        <QrCode size={72} strokeWidth={1.5} />
      </div>

      <p className="mt-4 text-sm font-semibold">Scan to request a song</p>
    </div>
  );
}

function GuestSearchStep() {
  return (
    <div className="flex flex-1 flex-col">
      <StepHeading>Find a track</StepHeading>

      <div className="mt-3 flex items-center gap-2 rounded-control border border-white/10 bg-black/50 px-3 py-2.5">
        <Search size={15} className="shrink-0 text-zinc-500" />
        <span className="truncate text-sm text-white">Massive Attack</span>
      </div>

      <div className="mt-3 space-y-2">
        {GUEST_SEARCH_RESULTS.map((track, index) => (
          <div
            key={track.id}
            className={`flex items-center gap-2.5 rounded-control p-2.5 ${
              index === 0
                ? "border border-accent/30 bg-accent/[0.08]"
                : "border border-transparent"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500">
              <Music2 size={15} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">
                {track.title}
              </p>
              <p className="truncate text-[11px] text-zinc-500">
                {track.artist}
              </p>
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
            <p className="truncate text-sm font-bold">{GUEST_REQUEST.title}</p>
            <p className="truncate text-xs text-zinc-500">
              {GUEST_REQUEST.artist}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-[13px]">
        <div className="flex items-center justify-between text-zinc-400">
          <span>Song request</span>
          <MoneyValue pence={GUEST_REQUEST.pence} />
        </div>
        <div className="flex items-center justify-between text-zinc-400">
          <span>Service fee</span>
          <MoneyValue pence={50} compact={false} />
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-2 font-bold text-white">
          <span>Total</span>
          <MoneyValue pence={GUEST_REQUEST.pence + 50} compact={false} />
        </div>
      </div>

      <div className="mt-auto">
        <div className="flex h-12 items-center justify-center rounded-control bg-accent-strong text-sm font-bold text-black">
          Send request
        </div>
        <p className="mt-2 text-center text-[10px] leading-tight text-zinc-600">
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
      <p className="mt-1 text-sm text-zinc-500">
        {GUEST_REQUEST.title} &middot; {GUEST_REQUEST.artist}
      </p>

      <div className="mt-4">
        <StatusBadge status="accepted" audience="guest" />
      </div>

      <p className="mt-4 text-xs text-zinc-600">You&apos;re #4 in the queue</p>

      {/* The real guest product has a My Requests page — this is the
          action a guest actually takes from here. */}
      <div className="mt-auto w-full">
        <div className="flex h-11 items-center justify-center gap-1.5 rounded-control border border-white/10 bg-white/5 text-[13px] font-semibold text-white">
          View my requests
          <ChevronRight size={15} />
        </div>
      </div>
    </div>
  );
}
