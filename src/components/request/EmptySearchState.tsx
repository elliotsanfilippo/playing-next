import { Music2 } from "lucide-react";

export default function EmptySearchState() {
  return (
    <div className="mt-8 rounded-card border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-zinc-400">
        <Music2 size={32} />
      </div>

      <h3 className="mt-6 text-2xl font-bold">Search for any song</h3>

      <p className="mx-auto mt-3 max-w-sm leading-7 text-zinc-500">
        Millions of tracks are available through Spotify. Start typing above
        to begin.
      </p>
    </div>
  );
}
