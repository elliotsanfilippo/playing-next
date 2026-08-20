"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { PRO_MONTHLY_PRICE_GBP } from "@/src/lib/pricing";

export default function PricingTeaser() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative z-10 px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="text-center"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Pricing
          </p>

          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, honest pricing
          </h2>

          <p className="mx-auto mt-4 max-w-lg text-zinc-400">
            No hidden fees. Pick the plan that fits how often you take
            requests.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, ease: [0.34, 1.4, 0.64, 1] }}
            className="rounded-card-lg border border-white/10 bg-zinc-900/40 p-6 backdrop-blur-md sm:p-8"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Free
            </p>

            <p className="mt-3 text-3xl font-bold">
              £0
              <span className="text-base font-medium text-zinc-500">
                /month
              </span>
            </p>

            <p className="mt-2 text-sm text-zinc-400">
              15% platform fee per accepted request
            </p>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.34, 1.4, 0.64, 1] }}
            className="relative overflow-hidden rounded-card-lg border border-accent/30 bg-accent/[0.04] p-6 shadow-[0_0_60px_-20px_rgba(74,222,128,0.35)] backdrop-blur-md sm:p-8"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-[80px]"
            />

            <p className="relative text-sm font-semibold uppercase tracking-wide text-accent">
              Pro
            </p>

            <p className="relative mt-3 text-3xl font-bold">
              £{PRO_MONTHLY_PRICE_GBP.toFixed(2)}
              <span className="text-base font-medium text-zinc-500">
                /month
              </span>
            </p>

            <p className="relative mt-2 text-sm text-zinc-400">
              0% platform fee, keep everything you earn
            </p>
          </motion.div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/plans"
            className="text-sm font-semibold text-accent hover:underline"
          >
            Compare full plan details →
          </Link>
        </div>
      </div>
    </section>
  );
}
