"use client";

import { useEffect, useSyncExternalStore } from "react";

/*
 * ── Making the drawer usable while the iOS keyboard is up ─────────
 *
 * Confirmed on the installed PN Admin iPhone app: with the keyboard
 * open, Save was off-screen, the drawer could not be scrolled far
 * enough to reach it, and the bottom Admin nav competed with the
 * keyboard.
 *
 * The reason is that iOS does not shrink the LAYOUT viewport when the
 * keyboard appears. window.innerHeight stays exactly what it was, so a
 * panel sized to 100% of it keeps its footer underneath the keyboard,
 * and there is no extra scroll range to reach it because nothing got
 * shorter. Only the VISUAL viewport changes, and only window
 * .visualViewport reports it.
 *
 * So the drawer is sized from visualViewport rather than from the
 * layout viewport, and positioned at its offsetTop. Nothing here is a
 * per-device pixel guess: every number is read from the browser at the
 * moment the keyboard moves, so it is correct on any iPhone, on iPad,
 * on Android, and in a desktop browser where the keyboard never appears
 * and the values simply equal the window.
 */

export type ViewportInsets = {
  /** Height actually visible to the user, in CSS pixels. */
  height: number;
  /** How far the visual viewport is scrolled down inside the layout one. */
  offsetTop: number;
  /** Height of the on-screen keyboard, 0 when it is closed. */
  keyboard: number;
  /** True once the keyboard is meaningfully open. */
  keyboardOpen: boolean;
};

const FALLBACK: ViewportInsets = {
  height: 0,
  offsetTop: 0,
  keyboard: 0,
  keyboardOpen: false,
};

/*
 * A keyboard is a large change; browser chrome collapsing on scroll is a
 * small one. The threshold keeps a URL bar hiding on Android from being
 * mistaken for a keyboard opening.
 */
const KEYBOARD_THRESHOLD = 120;

let snapshot: ViewportInsets = FALLBACK;

function read(): ViewportInsets {
  if (typeof window === "undefined") return FALLBACK;

  const vv = window.visualViewport;
  if (!vv) {
    /* No visualViewport: behave exactly as the app did before, sized to
       the layout viewport, with no keyboard ever reported. */
    return {
      height: window.innerHeight,
      offsetTop: 0,
      keyboard: 0,
      keyboardOpen: false,
    };
  }

  const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);

  const next: ViewportInsets = {
    height: vv.height,
    offsetTop: vv.offsetTop,
    keyboard,
    keyboardOpen: keyboard > KEYBOARD_THRESHOLD,
  };

  /* useSyncExternalStore compares snapshots by identity, so a fresh
     object every read would loop forever. Only replace it when a value
     actually moved. */
  if (
    snapshot.height !== next.height ||
    snapshot.offsetTop !== next.offsetTop ||
    snapshot.keyboard !== next.keyboard ||
    snapshot.keyboardOpen !== next.keyboardOpen
  ) {
    snapshot = next;
  }

  return snapshot;
}

function subscribe(callback: () => void) {
  const vv = window.visualViewport;
  if (!vv) {
    window.addEventListener("resize", callback);
    return () => window.removeEventListener("resize", callback);
  }

  vv.addEventListener("resize", callback);
  /* scroll matters too: iOS shifts the visual viewport when a field near
     the bottom is focused, without changing its height. */
  vv.addEventListener("scroll", callback);
  window.addEventListener("resize", callback);

  return () => {
    vv.removeEventListener("resize", callback);
    vv.removeEventListener("scroll", callback);
    window.removeEventListener("resize", callback);
  };
}

export function useVisualViewport(): ViewportInsets {
  return useSyncExternalStore(subscribe, read, () => FALLBACK);
}

/**
 * Keeps the focused field in view once the keyboard has finished moving.
 *
 * Driven by the viewport's own resize event rather than a timeout: the
 * browser tells us when the keyboard settled, so there is nothing to
 * guess at. Only ever scrolls the drawer's own scroll container, never
 * the page behind it.
 */
export function useKeepFocusVisible(
  containerRef: React.RefObject<HTMLElement | null>,
  keyboardOpen: boolean
) {
  useEffect(() => {
    if (!keyboardOpen) return;

    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    if (!containerRef.current?.contains(active)) return;

    active.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [keyboardOpen, containerRef]);
}
