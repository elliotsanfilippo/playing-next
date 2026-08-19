"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import DashboardPreview from "./DashboardPreview";
import { buttonVariants } from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";

export default function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative z-10">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-32">
          <div className="min-w-0">
            <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <Badge tone="accent" dot className="text-xs font-bold uppercase tracking-[0.18em]">
                Built for working DJs
              </Badge>
            </div>

            <h1
              className="animate-fade-up mt-7 max-w-3xl text-5xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "0.22s" }}
            >
              Accept paid
              <br />
              song requests.
              <br />
              <span className="text-accent">
                Earn more every set.
              </span>
            </h1>

            <p
              className="animate-fade-up mt-7 max-w-xl text-lg leading-8 text-zinc-400"
              style={{ animationDelay: "0.34s" }}
            >
              Playing Next gives DJs one place to receive paid song
              requests, manage their queue and stay in control of the
              music.
            </p>

            <div
              className="animate-fade-up mt-9 flex flex-col gap-3 sm:flex-row"
              style={{ animationDelay: "0.46s" }}
            >
              <Link
                href="/signup"
                className={buttonVariants({ size: "lg" })}
              >
                Start free
                <ArrowRight size={18} />
              </Link>

              <a
                href="#find-dj"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                Find your DJ
              </a>
            </div>

            <div
              className="animate-fade-up mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-500"
              style={{ animationDelay: "0.56s" }}
            >
              <span>No credit card required</span>
              <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
              <span>Set up in minutes</span>
            </div>
          </div>

          <motion.div
            className="min-w-0"
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </section>
  );
}
