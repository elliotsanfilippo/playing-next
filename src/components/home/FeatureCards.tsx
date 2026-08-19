"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type Feature = {
  icon: ReactNode;
  title: string;
  description: string;
};

type Props = {
  features: Feature[];
};

export default function FeatureCards({
  features,
}: Props) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="features"
      className="relative z-0 px-5 py-14 sm:px-6 sm:py-16 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="max-w-2xl"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Everything in one place
          </p>

          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Built to keep DJs in control.
          </h2>

          <p className="mt-5 text-lg leading-8 text-zinc-400">
            From payment authorisation to queue management,
            every part of the request flow happens inside
            Playing Next.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.94 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.45,
                delay: index * 0.08,
                ease: [0.34, 1.4, 0.64, 1],
              }}
              className="group rounded-card-lg border border-white/10 bg-zinc-900/40 p-7 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-accent/25 hover:bg-zinc-900/60"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent transition group-hover:scale-110 group-hover:border-accent/40">
                {feature.icon}
              </div>

              <h3 className="mt-7 text-2xl font-bold tracking-tight">
                {feature.title}
              </h3>

              <p className="mt-4 leading-7 text-zinc-400">
                {feature.description}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
