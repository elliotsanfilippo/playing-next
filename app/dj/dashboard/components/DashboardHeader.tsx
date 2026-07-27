import type { DJProfile } from "@/src/types/dashboard";

type Props = {
  djProfile: DJProfile | null;
  isTakingRequests: boolean;
  toggleRequests: () => void;
  logout: () => void;
  router: {
    push: (path: string) => void;
  };
};

export default function DashboardHeader({
  djProfile,
  isTakingRequests,
  toggleRequests,
  logout,
  router,
}: Props) {
  return (
    <header className="mb-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          {djProfile?.profile_image_url ? (
            <img
              src={djProfile.profile_image_url}
              alt={djProfile.dj_name}
              className="h-16 w-16 shrink-0 rounded-full border border-white/10 object-cover sm:h-20 sm:w-20"
            />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-full border border-white/10 bg-zinc-900 sm:h-20 sm:w-20" />
          )}

          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-400">
              👋 Good evening
            </p>

            <h1 className="mt-1 truncate text-3xl font-bold tracking-tight sm:text-5xl">
              {djProfile?.dj_name || "DJ Dashboard"}
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              House • UK Garage • Tech House
            </p>

            <button
              onClick={toggleRequests}
              className={`mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                isTakingRequests
                  ? "border border-green-500/20 bg-green-500/15 text-green-400 hover:bg-green-500/20"
                  : "border border-red-500/20 bg-red-500/15 text-red-400 hover:bg-red-500/20"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isTakingRequests ? "bg-green-400" : "bg-red-400"
                }`}
              />

              {isTakingRequests ? "Taking Requests" : "Requests Paused"}
            </button>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <button
            onClick={() => router.push("/dj/analytics")}
            className="h-12 rounded-full border border-white/10 bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Analytics
          </button>

          <button
            onClick={() => router.push("/dj/settings")}
            className="h-12 rounded-full border border-white/10 bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Settings
          </button>

          <button
            onClick={toggleRequests}
            className={`h-12 rounded-full px-6 text-sm font-semibold transition ${
              isTakingRequests
                ? "bg-green-500 text-black hover:bg-green-400"
                : "bg-red-500 text-white hover:bg-red-400"
            }`}
          >
            {isTakingRequests ? "Pause Requests" : "Resume Requests"}
          </button>

          <button
            onClick={logout}
            className="h-12 rounded-full border border-red-500/20 bg-red-500/10 px-6 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
          >
            Log Out
          </button>
        </div>
      </div>
    </header>
  );
}