type Step = {
  number: string;
  title: string;
  description: string;
};

type Props = {
  steps: Step[];
};

export default function HowItWorks({
  steps,
}: Props) {
  return (
    <section
        id="how-it-works"
        className="relative z-10 px-5 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-400">
              Start in minutes
            </p>

            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              How it works
            </h2>
          </div>

          <div className="relative mt-14 grid gap-5 md:grid-cols-5">
            <div className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-gradient-to-r from-transparent via-green-500/60 to-transparent md:block" />

            {steps.map((step) => (
              <article
                key={step.number}
                className="relative rounded-3xl border border-white/10 bg-zinc-900/50 p-6 text-center md:border-0 md:bg-transparent md:p-2"
              >
                <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-green-500/30 bg-[#0b130e] text-sm font-bold text-green-400 shadow-lg shadow-green-500/10">
                  {step.number}
                </div>

                <h3 className="mt-5 font-bold">{step.title}</h3>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
  );
}