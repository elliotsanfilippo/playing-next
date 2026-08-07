import Link from "next/link";
import { ArrowRight } from "lucide-react";
import DashboardPreview from "./DashboardPreview";
import { buttonVariants } from "@/src/components/ui/Button";
import Badge from "@/src/components/ui/Badge";

export default function Hero() {
  return (
    <section className="relative z-10">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-32">
          <div>
            <Badge tone="accent" dot className="text-xs font-bold uppercase tracking-[0.18em]">
              Built for working DJs
            </Badge>

            <h1 className="mt-7 max-w-3xl text-5xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Accept paid
              <br />
              song requests.
              <br />
              <span className="text-accent">
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
                className={buttonVariants({ size: "lg" })}
              >
                Start free
                <ArrowRight size={18} />
              </Link>

              <a
                href="#find-dj"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
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
