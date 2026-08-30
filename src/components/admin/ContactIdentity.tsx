"use client";

import Badge from "@/src/components/ui/Badge";
import { LIFECYCLE_LABELS } from "@/src/lib/djLifecycle";
import { rowIdentity } from "@/src/lib/djIdentity";
import { isInternalDj } from "@/src/lib/internalAccounts";
import { stageTone } from "@/src/components/admin/stageTone";
import type { PipelineRow } from "@/src/components/admin/crmTypes";

/*
 * ── One identity, one set of overflow rules ───────────────────────
 *
 * Identity used to be re-implemented per view: the Overview row applied
 * `truncate`, the Contacts card applied nothing. Seven slugs in the real
 * CRM are unbreakable tokens of 14 to 19 characters - /djbenphillipsmusic
 * has no space or hyphen to wrap at - so on the Contacts card the name
 * painted straight out of its box and under the lifecycle badge, while
 * the same name on Overview showed a tidy ellipsis.
 *
 * The fix is not a width for that DJ. It is that content length must
 * never decide whether the layout holds:
 *
 *   - the badge STACKS under the name on phones. Two flexible elements
 *     never share a row below md, so there is nothing to compete over.
 *   - the name still carries min-w-0 and truncate as a backstop, for
 *     larger iOS text sizes and for the desktop row where they do share.
 *   - break-all is deliberately not used: a slug broken mid-token across
 *     two lines is harder to read than one that ends in an ellipsis.
 */
export default function ContactIdentity({
  row,
  size = "md",
  inlineBadge = false,
  showStage = true,
}: {
  row: PipelineRow;
  size?: "sm" | "md";
  /** Desktop tables can afford name and badge on one row. Phones cannot. */
  inlineBadge?: boolean;
  /*
   * Off inside a grouped list whose heading already IS the stage. Four
   * rows under "Ready to activate" each captioned "Ready to activate"
   * is the badge noise the directory was meant to remove, not a
   * fourfold confirmation. The Internal tag is never suppressed: that
   * one still says something the heading does not.
   */
  showStage?: boolean;
}) {
  const id = rowIdentity(row);
  const internal = isInternalDj(row.dj?.slug);

  const name = (
    <p
      className={`min-w-0 truncate font-semibold text-white ${
        id.isSlug
          ? size === "sm"
            ? "font-mono text-xs"
            : "font-mono text-sm"
          : size === "sm"
            ? "text-sm"
            : "text-base"
      }`}
      title={id.primary}
    >
      {id.primary}
    </p>
  );

  const badge = (
    <span className="flex shrink-0 items-center gap-1.5">
      {showStage && (
        <Badge tone={stageTone(row.stage)}>{LIFECYCLE_LABELS[row.stage]}</Badge>
      )}
      {internal && (
        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">
          internal
        </span>
      )}
    </span>
  );

  if (inlineBadge) {
    return (
      <span className="flex min-w-0 items-center justify-between gap-3">
        {name}
        {badge}
      </span>
    );
  }

  if (!showStage && !internal) return <span className="block min-w-0">{name}</span>;

  return (
    <span className="block min-w-0">
      {name}
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{badge}</span>
    </span>
  );
}
