import type { DJProfile } from "@/src/types/dashboard";
import { MonitorPlay } from "lucide-react";
import Button from "@/src/components/ui/Button";

type Props = {
  djProfile: DJProfile | null;
  isTakingRequests: boolean;
  toggleRequests: () => void;
  logout: () => void;
  router: {
    push: (path: string) => void;
  };
};

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

export default function DashboardHeader({
  djProfile,
  isTakingRequests,
  toggleRequests,
  logout,
  router,
}: Props) {
  const genres = Array.isArray(djProfile?.genres)
    ? djProfile.genres
    : djProfile?.genres
      ? [djProfile.genres]
      : [];

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
              👋 {getGreeting()}
            </p>

            <h1 className="mt-1 truncate text-3xl font-bold tracking-tight sm:text-5xl">
              {djProfile?.dj_name || "DJ Dashboard"}
            </h1>

            {genres.length > 0 && (
              <p className="mt-2 text-sm text-zinc-400">
                {genres.join(" • ")}
              </p>
            )}

            <button
              onClick={toggleRequests}
              className={`mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                isTakingRequests
                  ? "border border-accent/20 bg-accent/15 text-accent hover:bg-accent/20"
                  : "border border-red-500/20 bg-red-500/15 text-red-400 hover:bg-red-500/20"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isTakingRequests ? "bg-accent" : "bg-red-400"
                }`}
              />

              {isTakingRequests ? "Taking Requests" : "Requests Paused"}
            </button>
          </div>
        </div>

        <div className="flex w-full flex-col items-end gap-3 sm:w-auto">
          <div className="flex w-full flex-wrap items-center justify-end gap-3">
            {djProfile?.slug && (
              <Button
                variant="secondary"
                onClick={() =>
                  window.open(`/request/${djProfile.slug}/queue`, "_blank")
                }
              >
                <MonitorPlay size={16} className="mr-2" />
                Display Screen
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => router.push("/dj/analytics")}
            >
              Analytics
            </Button>

            <Button
              variant="secondary"
              onClick={() => router.push("/dj/earnings")}
            >
              Earnings
            </Button>

            <Button
              variant="secondary"
              onClick={() => router.push("/dj/settings")}
            >
              Settings
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant={isTakingRequests ? "accent" : "danger"}
              className={
                isTakingRequests
                  ? ""
                  : "border-transparent bg-red-500 text-white hover:bg-red-400"
              }
              onClick={toggleRequests}
            >
              {isTakingRequests ? "Pause Requests" : "Resume Requests"}
            </Button>

            <Button variant="danger" onClick={logout}>
              Log Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
