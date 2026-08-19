"use client";

import { motion, useReducedMotion } from "motion/react";

type Step = {
  number: string;
  title: string;
  description: string;
};

type Props = {
  steps: Step[];
};

export default function HowItWorks({
  steps,
}: Props) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
        id="how-it-works"
        className="relative z-10 px-5 py-14 sm:px-6 sm:py-16 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="text-center"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Start in minutes
            </p>

            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              How it works
            </h2>
          </motion.div>

          <div className="relative mt-14 grid gap-5 md:grid-cols-5">
            {/* Connecting line draws left-to-right as the section enters
                view, like a signal travelling through each step in turn. */}
            <motion.div
              className="absolute left-[10%] right-[10%] top-7 hidden h-px origin-left bg-gradient-to-r from-transparent via-green-500/60 to-transparent md:block"
              initial={shouldReduceMotion ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            />

            {steps.map((step, index) => (
              <motion.article
                key={step.number}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: index * 0.22, ease: "easeOut" }}
                className="relative rounded-card border border-white/10 bg-zinc-900/50 p-6 text-center backdrop-blur-md md:border-0 md:bg-transparent md:p-2 md:backdrop-blur-none"
              >
                <motion.div
                  initial={shouldReduceMotion ? false : { scale: 0.5, opacity: 0 }}
                  whileInView={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: index * 0.22 + 0.1, ease: "easeOut" }}
                  className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-[#0b130e] text-sm font-bold text-accent shadow-lg shadow-green-500/10"
                >
                  {step.number}
                </motion.div>

                <h3 className="mt-5 font-bold">{step.title}</h3>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {step.description}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
  );
}
