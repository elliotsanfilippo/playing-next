"use client";

import { RefreshCw, AlertTriangle } from "lucide-react";

/*
 * ── Never let a stale screen look fresh ───────────────────────────
 *
 * PN Admin is an installed Home Screen app, so iOS usually resumes the
 * existing page rather than reloading it. Without this the Overview
 * could show a snapshot from days ago and look identical to one taken a
 * second ago - which is the same failure as an empty list standing in
 * for a failed load, just quieter.
 *
 * The label is computed at render rather than ticked by a timer. It is
 * therefore exact at the moments that matter - when the app becomes
 * visible, and after anything you do - and may lag if you sit staring
 * at an untouched screen. That is a deliberate trade against running a
 * background timer in an app opened a few times a day.
 */

const STALE_AFTER_MINUTES = 10;

export function freshnessLabel(at: number | null, now: number): string {
  if (!at) return "Not loaded";
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${new Date(at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })}`;
}

export function isStale(at: number | null, now: number): boolean {
  if (!at) return true;
  return now - at > STALE_AFTER_MINUTES * 60_000;
}

export default function FreshnessIndicator({
  lastFetchedAt,
  now,
  refreshFailed,
  refreshing,
  onRetry,
}: {
  lastFetchedAt: number | null;
  now: number;
  refreshFailed: boolean;
  refreshing: boolean;
  onRetry: () => void;
}) {
  const stale = isStale(lastFetchedAt, now);
  const label = freshnessLabel(lastFetchedAt, now);

  /*
   * A failed refresh is the only case that earns colour and an explicit
   * control, because it is the only case where the data on screen is
   * not going to fix itself. Merely old data says so quietly.
   */
  if (refreshFailed) {
    return (
      <button
        type="button"
        onClick={onRetry}
        disabled={refreshing}
        className="flex min-h-[44px] items-center gap-1.5 rounded-control px-2 font-mono text-[0.68rem] text-status-pending transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <AlertTriangle size={12} className="shrink-0" />
        <span className="hidden sm:inline">Couldn&rsquo;t refresh · </span>
        {label.toLowerCase()}
        <RefreshCw
          size={12}
          className={`shrink-0 ${refreshing ? "animate-spin" : ""}`}
        />
      </button>
    );
  }

  return (
    <span
      className={`font-mono text-[0.68rem] ${stale ? "text-status-pending/80" : "text-dim text-text-muted"}`}
      title={
        lastFetchedAt ? new Date(lastFetchedAt).toLocaleString() : undefined
      }
    >
      {refreshing ? "Updating..." : label}
    </span>
  );
}
