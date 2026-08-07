import Link from "next/link";
import DashboardPreview from "./DashboardPreview";

export default function Hero() {
  return (
    <section className="relative z-10">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-32">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Built for working DJs
            </div>

            <h1 className="mt-7 max-w-3xl text-5xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Accept paid
              <br />
              song requests.
              <br />
              <span className="text-green-400">
                Earn more every set.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-400">
              Playing Next gives DJs one place to receive paid song
              requests, manage their queue and stay in control of the
              music.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-white px-7 py-4 font-bold text-black transition hover:bg-zinc-200"
              >
                Start free
                <span className="ml-3">→</span>
              </Link>

              <a
                href="#find-dj"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-7 py-4 font-semibold text-white transition hover:bg-white/10"
              >
                Find your DJ
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-500">
              <span>No credit card required</span>
              <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
              <span>Set up in minutes</span>
            </div>
          </div>

          <DashboardPreview />
        </div>
      </section>
  );
}