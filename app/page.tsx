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
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 py-12 text-center sm:px-6">
        <p className="mb-4 rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
          Playing Next
        </p>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl">
          Paid song requests. Controlled by DJs.
        </h1>

        <p className="mt-6 max-w-2xl text-base text-white/70 sm:text-lg">
          Let crowds request tracks by scanning a QR code. DJs accept, decline,
          queue, and mark songs as Playing Next.
        </p>

        <div id="find-dj" className="mt-10 w-full max-w-xl sm:mt-12">
          <h2 className="mb-2 text-xl font-semibold">
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

        <div className="mt-8">
          <a
            href="/login"
            className="inline-flex rounded-full bg-white px-6 py-3 font-semibold text-black"
          >
            DJ Login
          </a>
        </div>
      </section>
    </main>
  );
}