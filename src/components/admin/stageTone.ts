import type { Tone } from "@/src/components/ui/Badge";
import type { LifecycleStage } from "@/src/lib/djLifecycle";

/*
 * Stage colour, resolved through the same semantic tones the rest of the
 * product uses rather than raw palette values.
 *
 * The scale is deliberately not a rainbow. Everything before a DJ has
 * taken real money is neutral or warning, and only the stages that mean
 * the product actually worked get the accent. That is what keeps the
 * funnel honest at a glance: today the accent column is empty for every
 * external DJ.
 */
export function stageTone(stage: LifecycleStage): Tone {
  switch (stage) {
    case "activated":
    case "repeat":
    case "pro":
      return "accent";
    case "ready_to_activate":
      return "info";
    case "onboarding_incomplete":
      return "warning";
    default:
      return "neutral";
  }
}
