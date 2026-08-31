"use client";

import { useSyncExternalStore } from "react";

/*
 * ── One definition of "is this a phone" ───────────────────────────
 *
 * Extracted from ContactsView, which owned the only copy until Overview
 * needed the same answer. Two components each deciding what counts as
 * desktop is how a breakpoint drifts, and this file has already been
 * bitten twice by the same rendering existing in two places.
 *
 * useSyncExternalStore rather than an effect: the value is read from an
 * external system, it must not cause a second render on mount, and it
 * gives a stable server snapshot so hydration cannot mismatch.
 */
const DESKTOP = "(min-width: 768px)";

function subscribe(callback: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => true
  );
}
