import { isInternalDj } from "./internalAccounts";

/*
 * ── The external funnel, and why it is not five steps ─────────────
 *
 * This is a PRESENTATION of facts djLifecycle.ts already derives. It
 * defines no new lifecycle stage and changes no threshold.
 *
 * The obvious design would be
 *   signed up -> onboarded -> payments ready -> activated -> repeat
 * and it would be wrong. Measured against production on 2026-08-29,
 * those sets do not nest:
 *
 *   13  external accounts
 *    4  onboarding_complete
 *    6  stripe_connected          <- counted on its own
 *    4  both
 *    0  activated
 *
 * Two DJs, /djbenphillipsmusic and /roxanemetzjyha, connected Stripe
 * and never finished onboarding. Drawing "13 -> 4 -> 4" would quietly
 * delete them from the picture, and they are the most interesting two
 * people in it: they completed the highest-friction step in the whole
 * product, handing over bank details, and then stalled on something
 * easier.
 *
 * So the funnel spine is only the genuinely nested path, and payments
 * is reported alongside it as a cross-cutting fact rather than forced
 * into a line it does not belong on. Every step below is a strict
 * subset of the step above it, which is the only thing that makes a
 * funnel shape honest.
 */

export type FunnelProfile = {
  id: string;
  slug: string;
  onboarding_complete?: boolean | null;
  stripe_connected?: boolean | null;
  paid_accepted_count: number;
  gig_date_count: number;
};

export type FunnelStep = {
  key: string;
  /** Reads as a plain sentence without knowing the implementation. */
  label: string;
  /** What this number counts, in words, shown in the UI. */
  definition: string;
  count: number;
  /** How many were lost between the previous step and this one. */
  lostFromPrevious: number | null;
};

export type ExternalFunnel = {
  steps: FunnelStep[];
  /** Total external accounts, the denominator for everything above. */
  total: number;
  /** stripe_connected counted on its own, NOT a funnel step. */
  paymentsReadyTotal: number;
  /** The ones that break the nesting, named so they can be shown. */
  paymentsReadyButNotOnboarded: FunnelProfile[];
  internalExcluded: number;
};

export function buildExternalFunnel(
  profiles: FunnelProfile[]
): ExternalFunnel {
  const external = profiles.filter((p) => !isInternalDj(p.slug));

  const onboarded = external.filter((p) => p.onboarding_complete === true);
  const paymentsReady = external.filter((p) => p.stripe_connected === true);

  /* "Ready" means both, because either alone cannot take a paid
     request. This is the set the activation question is really about. */
  const ready = onboarded.filter((p) => p.stripe_connected === true);
  const activated = ready.filter((p) => p.paid_accepted_count > 0);
  const repeat = activated.filter((p) => p.gig_date_count >= 2);

  /*
   * "Onboarded" and "Ready" are the same 4 people today, so showing
   * both would draw a step with no drop across it - noise that reads
   * like a stage where nothing happens. The step is included only when
   * the two genuinely differ.
   */
  const steps: FunnelStep[] = [
    {
      key: "signed_up",
      label: "signed up",
      definition: "External DJ accounts, excluding internal and test accounts",
      count: external.length,
      lostFromPrevious: null,
    },
    {
      key: "onboarded",
      label: "finished onboarding",
      definition: "Completed setup and connected payments, so they can take a paid request",
      count: ready.length,
      lostFromPrevious: external.length - ready.length,
    },
    {
      key: "activated",
      label: "took a paid request",
      definition: "Money actually moved at least once",
      count: activated.length,
      lostFromPrevious: ready.length - activated.length,
    },
    {
      key: "repeat",
      label: "came back for a second night",
      definition: "Took paid requests on two or more different nights",
      count: repeat.length,
      lostFromPrevious: activated.length - repeat.length,
    },
  ];

  if (onboarded.length !== ready.length) {
    steps.splice(2, 0, {
      key: "ready",
      label: "payments ready too",
      definition: "Finished onboarding and can receive money",
      count: ready.length,
      lostFromPrevious: onboarded.length - ready.length,
    });
  }

  return {
    steps,
    total: external.length,
    paymentsReadyTotal: paymentsReady.length,
    paymentsReadyButNotOnboarded: paymentsReady.filter(
      (p) => p.onboarding_complete !== true
    ),
    internalExcluded: profiles.length - external.length,
  };
}
