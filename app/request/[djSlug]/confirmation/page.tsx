"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function ConfirmationPage() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <section className="mx-auto flex min-h-screen max-w-2xl items-center justify-center">
        <div className="w-full rounded-3xl border border-green-500/20 bg-zinc-900 p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-4xl">
            ✅
          </div>

          <h1 className="mt-6 text-4xl font-bold">
            Payment Authorised
          </h1>

          <p className="mt-4 text-zinc-400">
            Your request has been submitted successfully.
          </p>

          <div className="mt-8 rounded-2xl border border-green-500/20 bg-green-500/10 p-6">
            <p className="text-lg font-semibold text-green-400">
              Waiting for DJ approval
            </p>

            <p className="mt-2 text-sm text-zinc-300">
              You’ll only be charged if the DJ accepts your request.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-6">
            <p className="text-sm text-zinc-500">
              Keep this page open for updates.
            </p>

            <p className="mt-2 text-zinc-300">
              The DJ may accept, decline, or mark your request as Playing Next.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
  <Link
    href={`/request/${djSlug}/my-requests`}
    className="rounded-2xl bg-white px-6 py-4 font-semibold text-black"
  >
    View My Requests
  </Link>

  <Link
    href={`/request/${djSlug}`}
    className="rounded-2xl border border-white/10 px-6 py-4 font-semibold text-white"
  >
    Request Another Song
  </Link>
</div>
        </div>
      </section>
    </main>
  );
}