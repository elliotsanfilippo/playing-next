import { hourLabel, type HourBucket } from "@/src/lib/analytics";

/*
 * When guests send requests, by the hour they sent them.
 *
 * Twenty-four CSS-height divs. No chart library: the whole shape of the
 * thing is one number per bar, and shipping a charting runtime to draw
 * 24 rectangles would cost more than the feature.
 *
 * This is submission time and nothing else. There is no played-at column
 * in the schema, so a "when do I play requests" chart cannot be built
 * honestly and is not attempted. The caption says so in the DJ's own
 * words rather than in a footnote.
 */
export default function HourChart({ hours }: { hours: HourBucket[] }) {
  const max = Math.max(...hours.map((h) => h.count), 1);
  const active = hours.filter((h) => h.count > 0);

  return (
    <div className="mt-3">
      {/* The bars are decoration over data that is also given as text
          below, so they carry no semantics of their own. */}
      <div aria-hidden className="flex h-24 items-end gap-[2px]">
        {hours.map((bucket) => (
          <div
            key={bucket.hour}
            title={`${hourLabel(bucket.hour)}: ${bucket.count}`}
            className="flex-1 rounded-t-[2px] bg-accent/25 data-[peak=true]:bg-accent"
            data-peak={bucket.count === max && bucket.count > 0}
            style={{
              /* A 2px floor so an empty hour still reads as a gap in a
                 row of bars rather than as the axis itself. */
              height: bucket.count === 0 ? "2px" : `${(bucket.count / max) * 100}%`,
            }}
          />
        ))}
      </div>

      <div
        aria-hidden
        /* zinc-400 at 10px. zinc-600 measured 2.35:1 against the card,
           which is a label you can see is there and cannot read. */
        className="mt-1.5 flex justify-between text-[10px] font-medium text-zinc-400"
      >
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>

      {/* The chart's text equivalent. Every hour that had a request,
          in order, which is the same information the bars carry. */}
      <ul className="sr-only">
        {active.map((bucket) => (
          <li key={bucket.hour}>
            {hourLabel(bucket.hour)}: {bucket.count} request
            {bucket.count === 1 ? "" : "s"}
          </li>
        ))}
      </ul>
    </div>
  );
}
