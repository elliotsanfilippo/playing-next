"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/src/components/ui/Button";

export default function CTA() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative z-10 px-5 pb-20 pt-8 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto flex max-w-7xl flex-col gap-7 overflow-hidden rounded-card-lg border border-accent/20 bg-gradient-to-r from-green-500/10 via-green-500/[0.04] to-transparent p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10"
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
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready for tonight?
            </h2>

            <p className="mt-3 text-zinc-400">
              Create your DJ profile and start taking requests.
            </p>
          </div>

          <Link
            href="/signup"
            className={buttonVariants({ size: "lg", className: "relative shrink-0" })}
          >
            Start free
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>
  );
}
