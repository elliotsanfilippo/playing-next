import type { ReminderSummary } from "@/src/lib/lifecycleEmailSummary";

/*
 * Nine DJs do not need a dashboard. This is four sentences, and it
 * refuses to state the one number it cannot know.
 */
export default function RemindersPanel({ summary }: { summary: ReminderSummary }) {
  const { tracked, untracked, emailed, reachedReady } = summary;

  if (emailed === 0) {
    return <p className="text-sm text-text-muted">No setup reminders have been sent.</p>;
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      {tracked.sent > 0 && (
        <p className="text-zinc-300">
          <span className="font-semibold text-white">{tracked.sent}</span> sent with return
          tracking, and{" "}
          <span className="font-semibold text-white">{tracked.returned}</span> came back to
          setup afterwards.
        </p>
      )}

      {untracked.sent > 0 && (
        <p className="text-text-muted">
          <span className="font-semibold text-zinc-300">{untracked.sent}</span> were sent
          before return tracking existed. Their CTA used the same marker as the in-app setup
          buttons, so whether those DJs came back cannot be told apart from ordinary use.{" "}
          <span className="text-zinc-400">
            Not counted as zero returns, because that is not what we know.
          </span>
        </p>
      )}

      <p className="border-t border-white/5 pt-4 text-zinc-300">
        Of the <span className="font-semibold text-white">{emailed}</span> DJs emailed,{" "}
        <span className="font-semibold text-white">{reachedReady}</span> have since reached
        Ready to activate.{" "}
        <span className="text-text-muted">
          This half is measurable for everyone, tracked or not.
        </span>
      </p>
    </div>
  );
}
