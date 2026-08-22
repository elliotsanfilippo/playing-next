"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/src/lib/cn";

type Props = {
  searchQuery: string;
  canRequest: boolean;
  onSearch: (value: string) => void;
};

export default function SpotifySearchInput({
  searchQuery,
  canRequest,
  onSearch,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      {/*
        A real <label>, visually hidden. The input previously had nothing
        but a placeholder, which disappears the moment anyone types and
        is not an accessible name at all.
      */}
      <label htmlFor="song-search" className="sr-only">
        Search for a song or artist
      </label>

      <div
        className={cn(
          "flex items-center gap-2.5 rounded-card border bg-surface-base px-3.5 transition-colors sm:gap-3 sm:px-4",
          canRequest
            ? "border-white/10 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/25"
            : "border-white/5 opacity-60"
        )}
      >
        <Search size={18} aria-hidden className="shrink-0 text-zinc-500" />

        <input
          id="song-search"
          ref={inputRef}
          disabled={!canRequest}
          type="search"
          value={searchQuery}
          onChange={(event) => onSearch(event.target.value)}
          /*
           * Mobile keyboard tuning. `search` gives the phone keyboard a
           * Search key instead of a newline, and turning off
           * autocorrect/autocapitalise matters here more than most
           * fields: track and artist names are exactly the kind of
           * proper nouns iOS likes to "fix" mid-word.
           */
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Search songs or artists"
          className="h-14 w-full min-w-0 bg-transparent text-base text-white outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
        />

        {searchQuery && canRequest && (
          <button
            type="button"
            onClick={() => {
              onSearch("");
              /* Focus stays in the field, so clearing is one tap and the
                 keyboard does not dismiss on a phone. */
              inputRef.current?.focus();
            }}
            /* 44x44, up from 36x36. The glyph stays small. */
            className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            aria-label="Clear search"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
