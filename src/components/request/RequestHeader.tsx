import Badge from "@/src/components/ui/Badge";
import { buttonVariants } from "@/src/components/ui/Button";

export type DJProfile = {
  id: string;
  dj_name: string;
  request_status: string;
  last_active_at: string | null;
  genres: string[] | string | null;
  bio: string | null;
  request_price: number | null;
  shoutout_price: number | null;
  profile_image_url: string | null;
};

type Props = {
  djSlug: string;
  djProfile: DJProfile;
  isTakingRequests: boolean;
  eventName?: string | null;
};

export default function RequestHeader({
  djSlug,
  djProfile,
  isTakingRequests,
  eventName,
}: Props) {
  const genres = Array.isArray(djProfile.genres)
    ? djProfile.genres
    : djProfile.genres
      ? [djProfile.genres]
      : [];

  return (
    <section className="overflow-hidden rounded-card-lg border border-white/10 bg-zinc-900/70">
      <div className="relative h-56 overflow-hidden sm:h-72">
        {djProfile.profile_image_url ? (
          <>
            <img
              src={djProfile.profile_image_url}
              alt={djProfile.dj_name}
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/35 to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-5xl font-bold text-zinc-600">
            {djProfile.dj_name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div className="relative -mt-20 px-6 pb-7 sm:px-8 sm:pb-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-zinc-400">Playing Next</p>

          <h1 className="mt-2 text-h1">{djProfile.dj_name}</h1>

          {eventName && (
            <p className="mt-1 text-sm font-semibold text-accent">
              Now taking requests for: {eventName}
            </p>
          )}

          <Badge tone={isTakingRequests ? "accent" : "danger"} dot className="mt-4">
            {isTakingRequests ? "Taking Requests" : "Requests Paused"}
          </Badge>

          {genres.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-zinc-300 backdrop-blur"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {djProfile.bio && (
            <p className="mt-5 max-w-xl leading-7 text-zinc-300">
              {djProfile.bio}
            </p>
          )}

          <a
            href={`/request/${djSlug}/my-requests`}
            className={buttonVariants({ variant: "secondary", className: "mt-6" })}
          >
            View My Requests
          </a>
        </div>
      </div>
    </section>
  );
}
