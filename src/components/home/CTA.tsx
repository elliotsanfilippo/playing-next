import Link from "next/link";
export default function CTA() {
  return (
    <section className="relative z-10 px-5 pb-20 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 rounded-[32px] border border-green-500/20 bg-gradient-to-r from-green-500/10 via-green-500/[0.04] to-transparent p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready for tonight?
            </h2>

            <p className="mt-3 text-zinc-400">
              Create your DJ profile and start taking requests.
            </p>
          </div>

          <Link
            href="/signup"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white px-7 py-4 font-bold text-black transition hover:bg-zinc-200"
          >
            Start free
            <span className="ml-3">→</span>
          </Link>
        </div>
      </section>
  );
}