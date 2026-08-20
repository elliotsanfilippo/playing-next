"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/src/components/ui/Button";

export default function CTA() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative z-10 px-5 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          /* Centred on a phone, where it is a standalone closing
             value-proposition moment; the deliberate two-column split
             with the action on the right returns at sm, where there is
             room for it to read as a composition rather than as a
             left-hanging block. */
          className="relative mx-auto flex max-w-7xl flex-col gap-6 overflow-hidden rounded-card-lg border border-accent/20 bg-gradient-to-r from-green-500/10 via-green-500/[0.04] to-transparent p-7 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-7 sm:p-10 sm:text-left"
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-green-500/15 blur-[100px]"
            animate={
              shouldReduceMotion
                ? undefined
                : { opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }
            }
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative">
            <h2 className="text-[1.75rem] font-bold tracking-tight sm:text-4xl">
              Ready for tonight?
            </h2>

            <p className="mx-auto mt-3 max-w-sm text-[0.95rem] leading-6 text-zinc-400 sm:mx-0 sm:max-w-none sm:text-base">
              Create your DJ profile and start taking requests.
            </p>
          </div>

          <Link
            href="/signup"
            className={buttonVariants({
              size: "lg",
              className: "relative w-full shrink-0 sm:w-auto",
            })}
          >
            Start free
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>
  );
}
