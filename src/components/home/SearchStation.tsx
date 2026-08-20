import Link from "next/link";
import { Search } from "lucide-react";
import Badge from "@/src/components/ui/Badge";

export type HomeDJ = {
  dj_name: string;
  slug: string;
  profile_image_url: string | null;
  request_status: string;
  genres: string[] | string | null;
};

type Props = {
  search: string;
  setSearch: (value: string) => void;
  loadingDJs: boolean;
  filteredDJs: HomeDJ[];
};

export default function SearchStation({
  search,
  setSearch,
  loadingDJs,
  filteredDJs,
}: Props) {
  return (
    <section
      id="find-dj"
      className="relative z-10 px-5 py-14 sm:px-6 sm:py-16 lg:px-8"
    >
      {/*
        The panel treatment starts at sm. On a phone the section already
        has its own gutter, so a bordered card inside it just nests one
        box in another and squeezes the search field between two sets of
        padding — the compressed-desktop look. Below sm this is plain
        content on the page.
      */}
      <div className="mx-auto max-w-7xl sm:rounded-card-lg sm:border sm:border-white/10 sm:bg-zinc-900/55 sm:p-10 sm:shadow-2xl sm:shadow-black/30 sm:backdrop-blur-xl lg:p-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            For guests
          </p>

          {/* text-balance stops "DJ?" being stranded alone on its own
              line at phone widths. */}
          <h2 className="mt-3 text-pretty text-[1.75rem] font-bold leading-[1.15] tracking-tight text-balance sm:text-4xl">
            Looking for your{" "}
            <span className="text-accent">DJ?</span>
          </h2>

          <p className="mx-auto mt-3 max-w-sm text-[0.95rem] leading-6 text-zinc-400 sm:max-w-none sm:text-base">
            Search for the DJ or event you want to send a request to.
          </p>

          <div className="mt-7 sm:mt-8">
            <div className="flex items-center rounded-card border border-white/10 bg-black/50 px-4 transition focus-within:border-accent/40 sm:px-5">
              <Search size={20} className="mr-3 shrink-0 text-zinc-500" />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search DJs..."
                className="h-14 w-full bg-transparent text-base text-white outline-none placeholder:text-zinc-600 sm:h-16"
              />
            </div>

            {/*
              Results sit in normal flow rather than in an absolutely
              positioned dropdown. As an overlay they contributed no
              height, so the section kept its collapsed size and the
              panel painted straight over the section below it —
              measured at 245px of overlap with six results. In flow the
              section grows to contain them, which is also the better
              behaviour on a phone, where a floating panel would cover
              most of the next screenful.
            */}
            {search.trim().length > 0 && (
              <div className="mt-3 overflow-hidden rounded-card border border-white/10 bg-zinc-950 p-2 text-left shadow-2xl shadow-black">
                {loadingDJs ? (
                  <div className="p-5 text-sm text-zinc-500">
                    Searching DJs...
                  </div>
                ) : filteredDJs.length === 0 ? (
                  <div className="p-5">
                    <p className="font-semibold text-zinc-300">
                      No DJs found
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      Check the spelling and try again.
                    </p>
                  </div>
                ) : (
                  filteredDJs.map((dj) => {
                    const isLive =
                      dj.request_status === "taking_requests";

                    const genreText = Array.isArray(dj.genres)
                      ? dj.genres.slice(0, 3).join(" · ")
                      : dj.genres || "DJ profile";

                    return (
                      <Link
                        key={dj.slug}
                        href={`/request/${dj.slug}`}
                        className="flex items-center justify-between gap-3 rounded-control p-3 transition hover:bg-white/5"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {dj.profile_image_url ? (
                            <img
                              src={dj.profile_image_url}
                              alt={dj.dj_name}
                              className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 font-bold text-zinc-400">
                              {dj.dj_name.slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-white">
                              {dj.dj_name}
                            </p>

                            <p className="mt-1 truncate text-sm text-zinc-500">
                              {genreText}
                            </p>
                          </div>
                        </div>

                        <Badge tone={isLive ? "accent" : "neutral"} dot>
                          {isLive ? "Live" : "Paused"}
                        </Badge>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
