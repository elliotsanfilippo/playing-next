"use client";

import { useEffect, useState } from "react";

/*
 * SSR-safe media query hook.
 *
 * Starts false and resolves after mount, so the server and the first
 * client render always agree — no hydration mismatch. Mobile-first is
 * the safe default: the mobile branch is the simpler, lower-risk
 * layout, so a desktop visitor sees at most one frame of it before it
 * upgrades, whereas the reverse would briefly hand a phone a layout
 * built for a 1280px viewport.
 *
 * Only reach for this where CSS genuinely can't express the
 * difference — conditional JS behaviour like scroll-linked animation
 * or sticky pinning. Plain layout differences belong in Tailwind
 * breakpoints, which need no JS at all.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);

    /*
     * Read through the same setter the listener uses, rather than
     * calling setMatches directly in the effect body: this
     * synchronises with an external system (the media query list)
     * exactly once on mount and then subscribes, which is the shape
     * effects are meant to have.
     */
    const sync = (matchesNow: boolean) =>
      setMatches((previous) => (previous === matchesNow ? previous : matchesNow));

    sync(list.matches);

    const onChange = (event: MediaQueryListEvent) => sync(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Matches Tailwind's `lg` breakpoint — the point at which the
 *  homepage switches from the stacked mobile story to the two-column
 *  cinematic layout. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
