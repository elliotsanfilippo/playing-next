"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { buttonVariants } from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";
import RequestCard from "@/src/components/product/RequestCard";
import { transition } from "@/src/lib/motion";

const QUEUE = [
  { title: "Don't You Worry Child", artist: "Swedish House Mafia", pence: 500 },
  { title: "Titanium", artist: "David Guetta", pence: 500 },
  { title: "Praise You", artist: "Fatboy Slim", pence: 800 },
];

export default function ProductShowcase() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative z-10 px-5 py-14 sm:px-6 sm:py-16 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto grid max-w-7xl grid-cols-1 gap-8 overflow-hidden rounded-card-lg border border-white/10 bg-zinc-900/40 p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-10 lg:grid-cols-[0.75fr_1.25fr] lg:p-12"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-green-500/10 blur-[110px]"
          />

          <div className="relative flex min-w-0 flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Built for the booth
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need.
              <br />
              Nothing you don&apos;t.
            </h2>

            <p className="mt-5 max-w-md leading-7 text-zinc-400">
              A clear live view of pending requests, your accepted
              queue, what is playing next and how much you have earned.
            </p>

            <Link
              href="/signup"
              className={buttonVariants({ variant: "secondary", className: "mt-8 w-fit" })}
            >
              Explore the dashboard
            </Link>
          </div>

          <div className="relative rounded-card border border-white/10 bg-black/40 p-4 backdrop-blur-md sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Live requests
                </p>

                <h3 className="mt-2 text-2xl font-bold">
                  Tonight&apos;s queue
                </h3>
              </div>

              <Badge tone="accent" className="relative">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Live
              </Badge>
            </div>

            <div className="mt-6 space-y-3">
              {QUEUE.map((track, index) => (
                <motion.div
                  key={track.title}
                  initial={shouldReduceMotion ? false : { opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ ...transition.state, delay: index * 0.12 }}
                >
                  <RequestCard
                    title={track.title}
                    artist={track.artist}
                    position={index + 1}
                    pence={track.pence}
                    size="compact"
                    actions={
                      <>
                        <span className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400">
                          Decline
                        </span>

                        <span className="rounded-lg bg-accent-strong px-3 py-1.5 text-xs font-bold text-black">
                          Accept
                        </span>
                      </>
                    }
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>
  );
}
