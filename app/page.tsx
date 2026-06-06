"use client";

import { useEffect, useState } from "react";
import { supabase } from "../src/lib/supabase";

type DJ = {
  dj_name: string;
  slug: string;
};

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [djs, setDjs] = useState<DJ[]>([]);

  useEffect(() => {
    const fetchDJs = async () => {
      const { data, error } = await supabase
        .from("dj_profiles")
        .select("dj_name, slug")
        .order("dj_name", { ascending: true });

      if (error) {
        console.log("DJ search error:", error);
        return;
      }

      setDjs(data || []);
    };

    fetchDJs();
  }, []);

  const filteredDJs = djs.filter((dj) =>
    dj.dj_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
    <div className="h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-[140px]" />
  </div>

  <div className="relative z-10 flex flex-col items-center">
    <img
      src="/logo.svg"
      alt="Playing Next"
      className="mb-8 h-20 w-20"
    />

    <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">
      Music requests.
      <br />
      Controlled by DJs.
    </h1>

        <p className="mt-6 max-w-2xl text-lg text-zinc-400">
  Guests request songs and shoutouts.
  DJs stay in control.
</p>

        <div
  id="find-dj"
  className="mt-16 w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-900/90 p-8 shadow-2xl shadow-violet-500/5 backdrop-blur"
>
          <h2 className="mb-2 text-2xl font-semibold">
  Looking for your DJ?
</h2>

          <p className="mb-4 text-sm text-white/60">
            Search by DJ name if you didn&apos;t scan their QR code.
          </p>

          <input
            type="text"
            placeholder="Search DJ name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-4 text-white outline-none placeholder:text-zinc-500"
          />

          {search.trim().length > 0 && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 text-left">
              {filteredDJs.length === 0 ? (
                <div className="p-4 text-sm text-zinc-400">
                  No DJs found.
                </div>
              ) : (
                filteredDJs.map((dj) => (
                  <a
                    key={dj.slug}
                    href={`/request/${dj.slug}`}
                    className="block border-b border-white/10 p-4 text-sm font-semibold transition last:border-b-0 hover:bg-zinc-800"
                  >
                    {dj.dj_name}
                  </a>
                ))
              )}
            </div>
          )}
        </div>

                <p className="mt-8 text-sm font-medium text-zinc-500">
          Built for bars, clubs, weddings and live events.
        </p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row">
          <a
            href="/login"
            className="rounded-full bg-white px-7 py-3 font-semibold text-black transition hover:opacity-90"
          >
            DJ Login
          </a>
        </div>
      </div>
    </section>
  </main>
);
}