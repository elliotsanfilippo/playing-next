"use client";

/* eslint-disable @next/next/no-img-element --
 * The DJ's avatar is a Supabase storage URL rendered at 56px. Routing
 * every DJ's avatar through the image optimizer buys nothing at that
 * size; the reflow risk the rule guards against is handled by the
 * explicit width/height below.
 */

import { useState } from "react";
import { ChevronDown, ListMusic } from "lucide-react";
import { cn } from "@/src/lib/cn";
import type { AvailabilityState } from "@/src/lib/guestAvailability";

export type DJProfile = {
  id: string;
  dj_name: string;
  request_status: string;
  last_active_at: string | null;
  auto_close_at?: string | null;
  genres: string[] | string | null;
  bio: string | null;
  request_price: number | null;
  shoutout_price: number | null;
  profile_image_url: string | null;
};

type Props = {
  djSlug: string;
  djProfile: DJProfile;
  availability: AvailabilityState;
  eventName?: string | null;
};

/*
 * How many genres stay on the face of the header.
 *
 * Enough to read as personality at a glance, few enough to stay on one
 * line at 375px. Anything beyond this moves into the disclosure rather
 * than wrapping the header onto a third and fourth row — the whole point
 * of this section is that it ends before the fold.
 */
const INLINE_GENRES = 3;

/*
 * The guest's arrival.
 *
 * This was a 224px hero image (288px from sm) with the name, badge, all
 * genres, the full bio and a My Requests button stacked underneath.
 * Measured at 375px it came to 618px, and the search field started 920px
 * down the page — 1.13 viewports. Someone who scanned a QR code in a
 * dark room to request a song had to scroll past a full screen of
 * profile before they could type anything.
 *
 * So identity is now a single row: avatar, name, state. It answers "who
 * am I requesting from, and can I?" and then stops. The DJ's own
 * material is not removed — a trimmed set of genres stays inline, and
 * the bio and any remaining genres sit behind a disclosure for the
 * guest who actually wants them. Nobody scanning to request a song is
 * made to read a biography first.
 */
export default function RequestHeader({
  djSlug,
  djProfile,
  availability,
  eventName,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const genres = Array.isArray(djProfile.genres)
    ? djProfile.genres
    : djProfile.genres
      ? [djProfile.genres]
      : [];

  const inlineGenres = genres.slice(0, INLINE_GENRES);
  const hiddenGenres = genres.slice(INLINE_GENRES);
  const hasDisclosure = Boolean(djProfile.bio) || hiddenGenres.length > 0;

  return (
    <section
      aria-label={`${djProfile.dj_name}, requests`}
      className="rounded-card border border-white/10 bg-surface-raised"
    >
      <div className="flex items-center gap-3 p-3.5 sm:gap-4 sm:p-5">
        {/*
          Fixed dimensions on the avatar. The old hero had neither, so
          the whole page reflowed once the image arrived.
        */}
        {djProfile.profile_image_url ? (
          <img
            src={djProfile.profile_image_url}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover sm:h-16 sm:w-16"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-overlay text-xl font-bold text-zinc-500 sm:h-16 sm:w-16"
          >
            {djProfile.dj_name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {eventName || "Requests for"}
          </p>

          <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight sm:text-2xl">
            {djProfile.dj_name}
          </h1>

          {/*
            State sits with the name rather than in a separate badge row,
            so "who" and "can I?" are one glance instead of two.
          */}
          <p
            className={cn(
              "mt-1 flex items-center gap-1.5 text-[13px] font-semibold",
              availability.canRequest ? "text-accent" : "text-status-declined"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                availability.canRequest ? "bg-accent" : "bg-status-declined"
              )}
            />
            {availability.label}
          </p>
        </div>

        <a
          href={`/request/${djSlug}/my-requests`}
          aria-label="View my requests"
          title="My requests"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <ListMusic size={18} aria-hidden />
        </a>
      </div>

      {(inlineGenres.length > 0 || hasDisclosure) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 px-3.5 py-2.5 sm:px-5">
          {inlineGenres.map((genre) => (
            <span
              key={genre}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400"
            >
              {genre}
            </span>
          ))}

          {hasDisclosure && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-controls="dj-about"
              className="ml-auto flex min-h-11 items-center gap-1 rounded text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              More about this DJ
              <ChevronDown
                size={14}
                aria-hidden
                className={cn(
                  "transition-transform duration-200 motion-reduce:transition-none",
                  expanded && "rotate-180"
                )}
              />
            </button>
          )}
        </div>
      )}

      {hasDisclosure && expanded && (
        <div
          id="dj-about"
          className="border-t border-white/5 px-3.5 py-4 sm:px-5"
        >
          {hiddenGenres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {hiddenGenres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {djProfile.bio && (
            <p
              className={cn(
                "text-sm leading-6 text-zinc-300",
                hiddenGenres.length > 0 && "mt-3"
              )}
            >
              {djProfile.bio}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
