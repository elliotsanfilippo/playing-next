"use client";

/* eslint-disable @next/next/no-img-element --
 * Remote Spotify CDN artwork. next/image would need every i.scdn.co
 * host allowlisted and would proxy a 56px thumbnail through the
 * optimizer for no gain. Intrinsic width/height and loading="lazy" are
 * set explicitly below, which is what the rule is actually protecting
 * against.
 */

import { motion, useReducedMotion } from "motion/react";
import { Music2 } from "lucide-react";
import { cn } from "@/src/lib/cn";
import ExplicitMark from "./ExplicitMark";

export type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
  artwork: string | null;
  explicit?: boolean;
};

type Props = {
  tracks: SpotifyTrack[];
  canRequest: boolean;
  onSelect: (track: SpotifyTrack) => void;
};

export default function TrackResults({ tracks, canRequest, onSelect }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const visibleTracks = tracks.slice(0, 8);

  if (visibleTracks.length === 0) return null;

  return (
    <div>
      <h2 className="sr-only">Search results</h2>

      {/* A list, not a stack of divs — a screen reader should be able to
          say how many results there are. */}
      <ul className="space-y-2">
        {visibleTracks.map((track, index) => (
          <motion.li
            key={track.id}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    duration: 0.18,
                    /* A short stagger so results read as arriving in
                       order rather than snapping in as one block. Capped
                       so the eighth row is never perceptibly late. */
                    delay: Math.min(index, 5) * 0.03,
                    ease: [0.22, 1, 0.36, 1],
                  }
            }
          >
            <button
              type="button"
              disabled={!canRequest}
              onClick={() => onSelect(track)}
              className={cn(
                "flex w-full items-center gap-3 rounded-card border border-white/10 bg-surface-base/60 p-2.5 text-left transition-colors",
                "hover:border-accent/30 hover:bg-surface-base",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
                "disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              {track.artwork ? (
                /*
                 * width/height and lazy loading. Eight artworks used to
                 * load eagerly with no intrinsic size, so every result
                 * set both reflowed the list and pulled 8 images at once
                 * on whatever signal the venue had.
                 */
                <img
                  src={track.artwork}
                  alt=""
                  width={56}
                  height={56}
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-600"
                >
                  <Music2 size={20} />
                </div>
              )}

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-[15px] font-semibold text-white">
                    {track.title}
                  </span>
                  {track.explicit && <ExplicitMark />}
                </span>

                <span className="mt-0.5 block truncate text-[13px] text-zinc-500">
                  {track.artist}
                </span>
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
