import { Music2, SearchX, WifiOff } from "lucide-react";
import Button from "@/src/components/ui/Button";

/*
 * The states a search can be in, and what each one shows.
 *
 * There used to be two of these and only one of them was reachable
 * usefully. TrackResults returned null on zero results, and the idle
 * prompt only rendered below two characters — so from the second
 * keystroke onward, both during the 300ms debounce plus network wait and
 * for any search that found nothing, the page rendered literally
 * nothing. The guest was left looking at empty space with no way to tell
 * whether the app was working, their query was wrong, or the venue's
 * signal had died.
 */
type Shell = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

function StateShell({ icon, title, body, action }: Shell & { action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-zinc-600">
        {icon}
      </div>

      <p className="mt-3 text-sm font-semibold text-zinc-300">{title}</p>

      <p className="mt-1 max-w-xs text-[13px] leading-5 text-zinc-500">
        {body}
      </p>

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SearchIdle() {
  return (
    <StateShell
      icon={<Music2 size={20} aria-hidden />}
      title="Search for any song"
      body="Type a track or artist name to find what you want the DJ to play."
    />
  );
}

/*
 * Skeleton rows rather than a spinner, matched to the real result rows
 * so results land into the same shape instead of pushing the page around
 * when they arrive.
 */
export function SearchLoading() {
  return (
    <div>
      {/* aria-busy rather than a live region: announcing "searching" on
          every keystroke would be worse than silence. */}
      <p className="sr-only" role="status">
        Searching
      </p>

      <ul aria-hidden className="space-y-2">
        {[0, 1, 2].map((row) => (
          <li
            key={row}
            className="flex items-center gap-3 rounded-card border border-white/5 bg-surface-base/40 p-2.5"
          >
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-white/5 motion-reduce:animate-none" />
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
              <div className="mt-2 h-3 w-2/5 animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SearchNoResults({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <StateShell
      icon={<SearchX size={20} aria-hidden />}
      title="No songs found"
      body={`Nothing matched "${query.trim()}". Try the artist's name, or check the spelling.`}
      action={
        <Button variant="secondary" onClick={onClear}>
          Clear search
        </Button>
      }
    />
  );
}

export function SearchError({ onRetry }: { onRetry: () => void }) {
  return (
    <StateShell
      icon={<WifiOff size={20} aria-hidden />}
      title="Song search isn't responding"
      body="This is usually a patchy connection. Your request page is still fine."
      action={
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
