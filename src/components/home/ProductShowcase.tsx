import Link from "next/link";
export default function ProductShowcase() {
  return (
    <section className="relative z-10 px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 overflow-hidden rounded-[34px] border border-white/10 bg-zinc-900/55 p-6 sm:p-10 lg:grid-cols-[0.75fr_1.25fr] lg:p-12">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-400">
              Built for the booth
            </p>

            <h2 className="mt-4 text-4xl font-bold tracking-tight">
              Everything you need.
              <br />
              Nothing you don&apos;t.
            </h2>

            <p className="mt-5 max-w-md leading-7 text-zinc-400">
              A clear live view of pending requests, your accepted
              queue, what is playing next and how much you have earned.
            </p>

            <Link
              href="/signup"
              className="mt-8 inline-flex w-fit rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold transition hover:bg-white/10"
            >
              Explore the dashboard
            </Link>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/45 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Live requests
                </p>

                <h3 className="mt-2 text-2xl font-bold">
                  Tonight&apos;s queue
                </h3>
              </div>

              <div className="rounded-full bg-green-500/15 px-3 py-1.5 text-xs font-semibold text-green-400">
                Live
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {[
                ["Miracle", "Calvin Harris", "£5"],
                ["One More Time", "Daft Punk", "£5"],
                ["Praise You", "Fatboy Slim", "£8"],
              ].map(([title, artist, price], index) => (
                <div
                  key={title}
                  className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sm font-bold text-zinc-500">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{title}</p>
                    <p className="truncate text-sm text-zinc-500">
                      {artist}
                    </p>
                  </div>

                  <span className="text-sm text-zinc-400">
                    {price}
                  </span>

                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500 text-sm font-bold text-black">
                    ✓
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
  );
}