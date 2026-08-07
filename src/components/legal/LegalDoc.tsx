import Link from "next/link";
import { ReactNode } from "react";
import Card from "@/src/components/ui/Card";
import Eyebrow from "@/src/components/ui/Eyebrow";

const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/guest-terms", label: "Guest Terms" },
  { href: "/legal/dj-terms", label: "DJ Terms" },
  { href: "/legal/refund-policy", label: "Refund & Cancellation Policy" },
];

export function LegalDoc({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-white sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-semibold text-zinc-400 transition hover:text-white"
        >
          ← Back to Playing Next
        </Link>

        <Eyebrow tone="accent" className="mt-8">
          Legal
        </Eyebrow>

        <h1 className="mt-3 text-display">{title}</h1>

        <p className="mt-3 text-sm text-zinc-500">Last updated: {lastUpdated}</p>

        <Card variant="elevated" className="mt-8 p-6 sm:p-10">
          <div className="legal-prose text-[15px] leading-7 text-zinc-300">
            {children}
          </div>
        </Card>

        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-500">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-h3 text-white first:mt-0">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4">{children}</p>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="mt-4 list-disc space-y-2 pl-5">{children}</ul>;
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-control border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200">
      {children}
    </div>
  );
}
