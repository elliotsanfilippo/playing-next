import Link from "next/link";
import Card from "@/src/components/ui/Card";
import { buttonVariants } from "@/src/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-white">
      <div className="w-full max-w-xl">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <img src="/logo.svg" alt="Playing Next" className="h-10 w-10" />
          <span className="text-base font-bold tracking-tight">
            Playing Next
          </span>
        </Link>

        <Card variant="elevated" className="p-8 text-center">
          <h1 className="text-h1">Page not found</h1>

          <p className="mt-4 text-zinc-400">
            The page you&apos;re looking for doesn&apos;t exist or may have
            moved.
          </p>

          <Link href="/" className={buttonVariants({ className: "mt-6" })}>
            Go to Playing Next
          </Link>
        </Card>
      </div>
    </main>
  );
}
