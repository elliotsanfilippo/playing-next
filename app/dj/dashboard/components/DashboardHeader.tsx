import type { DJProfile } from "@/src/types/dashboard";

type Props = {
  djProfile: DJProfile | null;
  isTakingRequests: boolean;
  toggleRequests: () => void;
  logout: () => void;
  router: any;
};

export default function DashboardHeader({
  djProfile,
  isTakingRequests,
  toggleRequests,
  logout,
  router,
}: Props) {
  return (
    <>
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          {djProfile?.profile_image_url ? (
            <img
              src={djProfile.profile_image_url}
              alt={djProfile.dj_name}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-zinc-800" />
          )}

          <div>
            <p className="text-sm text-zinc-400">Playing Next</p>

            <h1 className="mt-2 text-5xl font-bold">
              {djProfile?.dj_name || "DJ Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
  House • UK Garage • Tech House
</p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <button
            onClick={toggleRequests}
            className={`h-12 rounded-full px-6 text-sm font-semibold transition ${
              isTakingRequests
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {isTakingRequests ? "Taking Requests" : "Requests Paused"}
          </button>

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
            onClick={logout}
            className="h-12 rounded-full border border-red-500/20 bg-red-500/10 px-6 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
          >
            Log Out
          </button>
        </div>
      </div>{/* We'll paste the header here */}
    </>
  );
}