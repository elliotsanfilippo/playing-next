"use client";

/* eslint-disable @next/next/no-img-element --
 * Remote Spotify CDN artwork, sized explicitly so it cannot reflow.
 * See TrackResults for the full reasoning.
 */

import { motion, useReducedMotion } from "motion/react";
import { Music2, AlertCircle, Check } from "lucide-react";
import type { SpotifyTrack } from "./TrackResults";
import Button from "@/src/components/ui/Button";
import ExplicitMark from "./ExplicitMark";

type DuplicateWarning = {
  alreadyRequested: boolean;
  alreadyPlayed: boolean;
} | null;

type Props = {
  selectedSong: SpotifyTrack;
  duplicateWarning?: DuplicateWarning;
  onChangeSong: () => void;
};

export default function SelectedSong({
  selectedSong,
  duplicateWarning,
  onChangeSong,
}: Props) {
  const shouldReduceMotion = useReducedMotion();

  const warningText = duplicateWarning?.alreadyPlayed
    ? "Already played tonight. You can still request it, but it might not come round again."
    : duplicateWarning?.alreadyRequested
      ? "Someone's already requested this tonight."
      : null;

  return (
    /*
     * Accent-bordered, matching the Playing Next treatment on the DJ
     * side: this is the confirmed thing, and the guest should not have
     * to wonder whether their tap registered. One short settle on
     * arrival and nothing after — the tick and the border do the work.
     */
    <motion.section
      aria-label="Your selected song"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
      }
      className="overflow-hidden rounded-card border border-accent/25 bg-accent/[0.06]"
    >
      <div className="flex items-center gap-2 border-b border-accent/15 px-3.5 py-2.5 sm:px-5">
        <Check size={13} strokeWidth={3} aria-hidden className="text-accent" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          Your song
        </p>
      </div>

      {warningText && (
        <div className="flex items-start gap-2 border-b border-status-pending-surface/20 bg-status-pending-surface/[0.07] px-3.5 py-2.5 text-[13px] leading-5 text-status-pending sm:px-5">
          <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
          <p>{warningText}</p>
        </div>
      )}

      <div className="flex items-center gap-3 p-3.5 sm:gap-4 sm:p-5">
        {selectedSong.artwork ? (
          <img
            src={selectedSong.artwork}
            alt=""
            width={64}
            height={64}
            decoding="async"
            className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-lg shadow-black/30"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-600"
          >
            <Music2 size={24} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight sm:text-xl">
            <span className="min-w-0 truncate">{selectedSong.title}</span>
            {selectedSong.explicit && <ExplicitMark />}
          </h2>

          <p className="mt-0.5 truncate text-sm text-zinc-400">
            {selectedSong.artist}
          </p>
        </div>

        {/* h-11, up from h-9. Sits beside the song rather than under it,
            so the card stays one compact row. */}
        <Button
          variant="secondary"
          onClick={onChangeSong}
          className="h-11 shrink-0 px-4 text-[13px]"
        >
          Change
        </Button>
      </div>
    </motion.section>
  );
}
