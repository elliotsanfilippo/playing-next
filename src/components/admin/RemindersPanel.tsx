import type { ReminderSummary } from "@/src/lib/lifecycleEmailSummary";

/*
 * ── Setup reminders ───────────────────────────────────────────────
 *
 * Rebuilt 2026-09-04 after visual QA called it the weakest section.
 *
 * Two things were wrong, and only one of them was the writing.
 *
 * The layout bug first: this panel rendered no padding of its own.
 * Every sibling panel adds its own p-5 because AccordionSection's body
 * deliberately has none, so this was the one section whose text sat
 * flush against the card border.
 *
 * Then the hierarchy. It opened with three paragraphs and buried every
 * figure inside a sentence, so the operational question - how many were
 * emailed, and did it work - had to be read for rather than seen. The
 * numbers now come first as a metric row and the paragraphs explain
 * them underneath.
 *
 * What has NOT changed is what the section refuses to say. An untracked
 * send cannot be reported as zero returns, and that sentence stays in
 * full: it is the difference between "we measured nothing" and "nothing
 * happened", and it is the whole reason this panel is honest.
 */
export default function RemindersPanel({ summary }: { summary: ReminderSummary }) {
  const { tracked, untracked, emailed, reachedReady } = summary;

  if (emailed === 0) {
    return (
      <p className="p-5 text-sm text-text-muted">
        No setup reminders have been sent.
      </p>
    );
  }

  /* Returns are only a number when every send could be attributed. */
  const returnsKnown = untracked.sent === 0;

  return (
    <div className="flex flex-col">
      <dl className="flex flex-wrap gap-x-10 gap-y-4 p-5">
        <div>
          <dd className="font-mono text-2xl font-medium leading-none text-white">
            {emailed}
          </dd>
          <dt className="mt-1.5 text-xs text-text-muted">emailed</dt>
        </div>

        <div>
          <dd
            className={`font-mono text-2xl font-medium leading-none ${
              reachedReady > 0 ? "text-accent" : "text-white"
            }`}
          >
            {reachedReady}
          </dd>
          <dt className="mt-1.5 text-xs text-text-muted">
            since reached Ready to activate
          </dt>
        </div>

        <div>
          <dd
            className={`font-mono text-2xl font-medium leading-none ${
              returnsKnown ? "text-white" : "text-text-muted"
            }`}
          >
            {returnsKnown ? tracked.returned : "—"}
          </dd>
          <dt className="mt-1.5 text-xs text-text-muted">
            {returnsKnown ? "came back to setup" : "returns not measurable"}
          </dt>
        </div>
      </dl>

      <div className="flex flex-col gap-3 border-t border-white/5 p-5 text-sm">
        {tracked.sent > 0 && (
          <p className="text-text-muted">
            <span className="font-semibold text-zinc-300">{tracked.sent}</span>{" "}
            sent with return tracking, and{" "}
            <span className="font-semibold text-zinc-300">
              {tracked.returned}
            </span>{" "}
            came back to setup afterwards.
          </p>
        )}

        {untracked.sent > 0 && (
          <p className="text-text-muted">
            <span className="font-semibold text-zinc-300">
              {untracked.sent}
            </span>{" "}
            were sent before return tracking existed. Their CTA used the same
            marker as the in-app setup buttons, so whether those DJs came back
            cannot be told apart from ordinary use.{" "}
            <span className="text-zinc-400">
              Not counted as zero returns, because that is not what we know.
            </span>
          </p>
        )}

        <p className="text-text-muted">
          The Ready to activate figure is measurable for everyone, tracked or
          not.
        </p>
      </div>
    </div>
  );
}
