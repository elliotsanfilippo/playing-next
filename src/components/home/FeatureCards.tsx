import type { ReactNode } from "react";

type Feature = {
  icon: ReactNode;
  title: string;
  description: string;
};

type Props = {
  features: Feature[];
};

export default function FeatureCards({
  features,
}: Props) {
  return (
    <section
      id="features"
      className="relative z-0 px-5 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Everything in one place
          </p>

          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Built to keep DJs in control.
          </h2>

          <p className="mt-5 text-lg leading-8 text-zinc-400">
            From payment authorisation to queue management,
            every part of the request flow happens inside
            Playing Next.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-card-lg border border-white/10 bg-zinc-900/60 p-7 transition hover:-translate-y-1 hover:border-accent/20"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                {feature.icon}
              </div>

              <h3 className="mt-7 text-2xl font-bold tracking-tight">
                {feature.title}
              </h3>

              <p className="mt-4 leading-7 text-zinc-400">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
