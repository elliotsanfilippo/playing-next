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

  /*
   * The fixed element and the animated element are deliberately two
   * different nodes.
   *
   * The reveal used to be applied to the <header> itself, which left a
   * transform on a position:fixed box. That is fine on paper, but on
   * iOS Safari a transformed fixed element gets promoted to its own
   * compositing layer and visibly detaches from the top of the screen
   * during momentum and rubber-band scrolling — the bar drifts and
   * page content shows above it, which reads exactly as the header
   * having come unpinned. Keeping the transform on an ordinary child
   * means the fixed box is never transformed and has nothing to
   * detach.
   *
   * The <header> is also the only thing that has to stay at the top;
   * because it is fixed it is out of flow, so nothing below it ever
   * shifts when the bar appears or disappears.
   */
  return (
    <header
      style={{ pointerEvents: isInteractive ? "auto" : "none" }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <motion.div
        initial={false}
        animate={{
          opacity: isInteractive ? 1 : 0,
          y: isInteractive ? 0 : -12,
        }}
        transition={shouldReduceMotion ? { duration: 0 } : transition.structural}
        /*
         * The bar's own surface: it carries the background, so nothing
         * is painted while the bar is hidden, and the safe-area padding,
         * so on a notched phone the background extends up behind the
         * status bar while the content sits below it.
         *
         * The background is close to opaque by default and only becomes
         * glassy where backdrop-filter is actually supported. At 50%
         * black with no working blur — which is what a good number of
         * Android browsers give you — the page is plainly legible
         * through the bar, and content sliding past behind a header is
         * indistinguishable from a header that is not pinned.
         */
        className="border-b border-white/5 bg-canvas/95 pt-[env(safe-area-inset-top)] supports-[backdrop-filter]:bg-canvas/65 supports-[backdrop-filter]:backdrop-blur-xl"
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
      </motion.div>
    </header>
  );
}
