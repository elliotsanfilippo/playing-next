"use client";

import { useEffect, useRef } from "react";

/*
 * ── Dialog behaviour the Dashboard's modals were missing ──────────
 *
 * Measured on the live dashboard during the Phase 6A Tier 3 audit: with
 * the QR formats modal open, focus never left <body>, Escape did nothing,
 * and 19 of the 24 focusable elements on the page were still outside the
 * modal and reachable with Tab.
 *
 * One of those 19 is Pause. A DJ operating by keyboard could tab out of a
 * print dialog and onto the control that takes them off the air, mid-set.
 * That is the reason this exists; the WCAG boxes it also ticks are a
 * secondary benefit.
 *
 * Deliberately a hook rather than a Dialog component. Both modals already
 * have their own markup and visual design that this phase was told not to
 * change, so this adds the behaviour and leaves the appearance alone.
 */
/*
 * ── Which dialog is on top ────────────────────────────────────────
 *
 * Mount order, not document order. The task sheet renders BEFORE the
 * contact drawer in app/admin/page.tsx but opens above it, so the
 * previous test - the last [role="dialog"] in the document - named the
 * drawer as topmost while the sheet was open. Escape therefore closed
 * the contact drawer out from under the sheet, and the sheet was left
 * over a dead page.
 *
 * A stack cannot get that wrong: whatever opened last is on top,
 * wherever it happens to sit in the DOM.
 */
const dialogStack: HTMLElement[] = [];

type Options = {
  /** Whether the dialog is currently open. */
  open: boolean;
  /** Called on Escape, and on any other request to dismiss. */
  onClose: () => void;
};

export function useModalA11y({ open, onClose }: Options) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  /*
   * Captured on open rather than on mount. The trigger is whatever had
   * focus at the moment the dialog appeared, and returning focus there on
   * close is what keeps a keyboard user's place in the page instead of
   * dumping them back at the top.
   */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  /*
   * onClose is read through a ref so it can stay out of the effect's
   * dependencies.
   *
   * This is the P0 that made + Task unusable on the installed iPhone
   * app. Both callers pass an inline arrow - onClose={() =>
   * setTaskSheet(null)} - so onClose had a new identity on every render
   * of the Admin page, and this effect tore down and re-ran every time.
   * Opening the task sheet is itself a state change on that page, so the
   * drawer's effect re-ran at the exact moment the sheet existed, walked
   * the sibling list again, and marked the freshly-mounted sheet inert.
   * The sheet appeared, and nothing inside it could be tapped or
   * focused. Reproduced in the browser against this DOM shape before the
   * fix and again after it.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const container = containerRef.current;
    if (container) dialogStack.push(container);

    const isTopmost = () =>
      dialogStack.length === 0 ||
      dialogStack[dialogStack.length - 1] === container;

    const focusable = () =>
      Array.from(
        container?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    /*
     * Move focus in. The container itself is the fallback target when a
     * dialog has no focusable content of its own, which is why it carries
     * tabIndex={-1} — without somewhere to land, focus stays on <body> and
     * the first Tab press escapes into the page behind.
     *
     * Unless the dialog has already put focus somewhere itself. React
     * honours autoFocus during commit, before this runs, so the previous
     * unconditional focus() moved off the task sheet's title field and
     * onto its close button - you tapped + Task and got a dismiss button
     * rather than a keyboard. A dialog that has expressed a preference
     * knows better than a generic first-focusable rule.
     */
    if (!container?.contains(document.activeElement)) {
      const first = focusable()[0] ?? container;
      first?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        /*
         * Only the topmost dialog reacts. The task sheet opens above the
         * contact drawer, and both listen on document with capture, so
         * without this one Escape would close the sheet AND the drawer
         * underneath it - losing the contact you were working on because
         * you dismissed a date picker.
         */
        if (!isTopmost()) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) {
        /* Nothing to move between, so keep focus on the container rather
           than letting Tab leave the dialog entirely. */
        event.preventDefault();
        container?.focus();
        return;
      }

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      /* The wrap. Shift+Tab off the first item goes to the last, Tab off
         the last goes back to the first, and focus never reaches the
         Dashboard underneath. */
      if (event.shiftKey && (active === firstItem || active === container)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    /*
     * Belt and braces alongside the Tab handling: while the dialog is
     * open everything outside it is inert, so a click, a screen reader's
     * virtual cursor or a browser quirk cannot reach it either.
     *
     * This walks the ancestor path from the dialog up to <body> and marks
     * the siblings at every level. The first attempt only marked
     * body-level children, which did nothing at all here: the dialog and
     * the Dashboard are rendered inside the same React root, so the
     * Dashboard was never a sibling of anything that got marked and Pause
     * was still focusable with the dialog open. Verified on the live
     * dashboard before and after.
     */
    /*
     * Lock the page behind. Measured on the live Admin during the 6B.1
     * review: a wheel over the open drawer scrolled the list underneath
     * by 673px, because the drawer is its own scroll container and the
     * overflow chained to the document once it reached its end.
     *
     * The padding compensation stops the page shifting sideways as the
     * scrollbar disappears, which otherwise reads as the whole layout
     * flinching the moment a dialog opens.
     */
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const marked: HTMLElement[] = [];

    /*
     * Only the dialog on top marks anything. A dialog underneath one
     * that is already open has nothing useful to say about what should
     * be reachable - and if it marked its siblings it would mark the
     * dialog above it, which is precisely the failure this pair of
     * changes exists to make impossible.
     */
    let node: HTMLElement | null = isTopmost() ? container : null;

    while (node && node !== document.body) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;

      Array.from(parent.children).forEach((sibling) => {
        if (sibling === node || !(sibling instanceof HTMLElement)) return;
        if (sibling.hasAttribute("inert")) return;
        sibling.setAttribute("inert", "");
        marked.push(sibling);
      });

      node = parent;
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (container) {
        const at = dialogStack.lastIndexOf(container);
        if (at !== -1) dialogStack.splice(at, 1);
      }
      marked.forEach((el) => el.removeAttribute("inert"));
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      returnFocusRef.current?.focus();
    };
  }, [open]);

  /*
   * Spread onto the dialog's outermost element. aria-labelledby points at
   * the dialog's own heading, so the id passed here must exist in its
   * markup.
   */
  const dialogProps = (labelledBy: string) =>
    ({
      ref: containerRef,
      role: "dialog",
      "aria-modal": true,
      "aria-labelledby": labelledBy,
      tabIndex: -1,
    }) as const;

  return { containerRef, dialogProps };
}
