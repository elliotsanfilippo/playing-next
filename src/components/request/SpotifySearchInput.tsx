import { Search, X } from "lucide-react";

type Props = {
  searchQuery: string;
  isTakingRequests: boolean;
  onSearch: (value: string) => void;
};

export default function SpotifySearchInput({
  searchQuery,
  isTakingRequests,
  onSearch,
}: Props) {
  return (
    <div className="mt-8">
      <div
        className={`flex items-center gap-4 rounded-card border bg-black/50 px-5 transition ${
          isTakingRequests
            ? "border-white/10 focus-within:border-accent/40 focus-within:bg-black/70"
            : "border-white/5 opacity-50"
        }`}
      >
        <Search size={20} className="shrink-0 text-zinc-500" />

        <input
          disabled={!isTakingRequests}
          type="search"
          value={searchQuery}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={
            isTakingRequests
              ? "Search songs or artists..."
              : "Requests are currently paused"
          }
          className="h-20 w-full bg-transparent text-lg text-white outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
        />

        {searchQuery && isTakingRequests && (
          <button
            type="button"
            onClick={() => onSearch("")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isTakingRequests && searchQuery.length < 2 && (
        <p className="mt-3 text-sm text-zinc-600">
          Search by track title or artist.
        </p>
      )}
    </div>
  );
}
