import Skeleton from "@/src/components/ui/Skeleton";

export default function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-canvas p-5 text-white sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4 sm:gap-5">
            <Skeleton className="h-16 w-16 shrink-0 rounded-full sm:h-20 sm:w-20" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-8 w-40 rounded-full" />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-12 w-28" />
            <Skeleton className="h-12 w-28" />
            <Skeleton className="h-12 w-32" />
          </div>
        </header>

        <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-card" />
          ))}
        </div>

        <Skeleton className="mb-8 h-40 rounded-card-lg" />

        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-card" />
          <Skeleton className="h-80 rounded-card" />
        </div>
      </div>
    </main>
  );
}
