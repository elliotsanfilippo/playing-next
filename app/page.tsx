export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
          Playing Next
        </p>

        <h1 className="max-w-3xl text-5xl font-bold tracking-tight md:text-7xl">
          Paid song requests. Controlled by DJs.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-white/70">
          Let crowds request tracks by scanning a QR code. DJs accept, decline,
          queue, and mark songs as Playing Next.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <a
            href="/dj/dashboard"
            className="rounded-full bg-white px-6 py-3 font-semibold text-black"
          >
            DJ Dashboard
          </a>

          <a
            href="/request/dj-elliot"
            className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white"
          >
            Request a Song
          </a>
        </div>
      </section>
        </main>
  );
}