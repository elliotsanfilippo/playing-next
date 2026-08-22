import Skeleton from "@/src/components/ui/Skeleton";

/*
 * Mirrors the real dashboard's composition and spacing scale, so the
 * page does not visibly rearrange when data lands. It previously
 * sketched the pre-3A layout — a tall identity header, four stat tiles
 * and a large Playing Next block — none of which exist any more.
 */
export default function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-canvas px-5 pb-10 text-white sm:px-6">
      {/* Live bar */}
      <div className="-mx-5 mb-4 border-b border-white/10 px-5 py-3 sm:-mx-6 sm:mb-6 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Skeleton className="hidden h-11 w-11 shrink-0 rounded-full lg:block" />
          <Skeleton className="hidden h-5 w-28 lg:block" />
          <Skeleton className="h-12 w-52 rounded-full sm:h-11" />

          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-12 w-12 rounded-full sm:h-11 sm:w-11" />
            <Skeleton className="h-12 w-12 rounded-full sm:h-11 sm:w-11" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        {/* Measured against the real strip rather than estimated:
            123px at 375-430 and 99px at sm and above. The old 112/96
            left an 11px jump on a phone every time data landed. */}
        <Skeleton className="h-[123px] rounded-card sm:h-[99px]" />

        {/* lg:items-stretch to match the real workspace, or the two
            columns settle at different heights on first paint and then
            equalise when data arrives. */}
        <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-2 lg:items-stretch">
          <Skeleton className="h-64 rounded-card" />

          {/* Playing Next is ~80px empty and ~180px populated, so the
              placeholder sits between the two rather than committing to
              either and guaranteeing a shift one way. */}
          <div className="space-y-4 sm:space-y-6">
            <Skeleton className="h-32 rounded-card" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        </div>
      </div>
    </main>
  );
}
