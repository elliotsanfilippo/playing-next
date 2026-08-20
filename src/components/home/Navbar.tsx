"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { buttonVariants } from "@/src/components/ui/Button";
import { transition } from "@/src/lib/motion";

type Props = {
  /** Hidden during the opening scene so nothing competes with the
   *  Accept Request moment; revealed once the visitor moves on. */
  revealed?: boolean;
};

export default function Navbar({ revealed = true }: Props) {
  const shouldReduceMotion = useReducedMotion();

  /*
   * Always rendered — never conditionally mounted — so the nav links
   * stay in the DOM for crawlers, keyboard users and anyone with
   * reduced motion, regardless of scroll position. Only its visual
   * presentation is animated.
   *
   * pointer-events are disabled while hidden so an invisible bar can't
   * swallow clicks meant for the opening card underneath it.
   */
  const isInteractive = revealed || shouldReduceMotion;

  return (
    <motion.header
      initial={false}
      animate={{
        opacity: isInteractive ? 1 : 0,
        y: isInteractive ? 0 : -12,
      }}
      transition={shouldReduceMotion ? { duration: 0 } : transition.structural}
      style={{ pointerEvents: isInteractive ? "auto" : "none" }}
      className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="Playing Next"
            className="h-9 w-9"
          />

          <span className="text-base font-bold tracking-tight sm:text-lg">
            Playing Next
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-400 lg:flex">
          <a href="#dashboard" className="transition hover:text-white">
            Product
          </a>

          <a href="#features" className="transition hover:text-white">
            For DJs
          </a>

          <a href="#find-dj" className="transition hover:text-white">
            Find your DJ
          </a>

          <Link href="/plans" className="transition hover:text-white">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/login"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "rounded-full px-3 sm:px-4",
            })}
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className={buttonVariants({
              size: "sm",
              className: "rounded-full px-4 sm:px-5",
            })}
          >
            Start free
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
