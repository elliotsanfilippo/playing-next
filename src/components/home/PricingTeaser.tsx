import Link from "next/link";
import { PRO_MONTHLY_PRICE_GBP } from "@/src/lib/pricing";

export default function PricingTeaser() {
  return (
    <section className="relative z-10 px-5 py-14 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Pricing
          </p>

          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, honest pricing
          </h2>

          <p className="mx-auto mt-4 max-w-lg text-zinc-400">
            No hidden fees. Pick the plan that fits how often you take
            requests.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <div className="rounded-card-lg border border-white/10 bg-zinc-900/50 p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Free
            </p>

            <p className="mt-3 text-3xl font-bold">
              £0
              <span className="text-base font-medium text-zinc-500">
                /month
              </span>
            </p>

            <p className="mt-2 text-sm text-zinc-400">
              15% platform fee per accepted request
            </p>
          </div>

          <div className="rounded-card-lg border border-accent/30 bg-accent/[0.04] p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Pro
            </p>

            <p className="mt-3 text-3xl font-bold">
              £{PRO_MONTHLY_PRICE_GBP.toFixed(2)}
              <span className="text-base font-medium text-zinc-500">
                /month
              </span>
            </p>

            <p className="mt-2 text-sm text-zinc-400">
              0% platform fee, keep everything you earn
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/plans"
            className="text-sm font-semibold text-accent hover:underline"
          >
            Compare full plan details →
          </Link>
        </div>
      </div>
    </section>
  );
}
