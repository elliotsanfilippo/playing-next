import {
  isAcceptedOutcome,
  isDjDecision,
  isSubmittedRequest,
} from "@/src/lib/requestStatus";

/*
 * What /dj/analytics is allowed to say.
 *
 * Every function here is pure and takes its rows and its clock as
 * arguments, so the page renders exactly what a test can assert. The
 * page itself does no arithmetic.
 *
 * Three rules run through all of it:
 *
 *   1. The population is isSubmittedRequest, defined once in
 *      requestStatus.ts. Internal checkout rows, legacy archived rows
 *      and abandoned checkouts are not requests and are never counted.
 *   2. dj_hidden is never read. Clearing Recent Activity is a display
 *      preference and cannot move a number on this page (Phase 5A.1).
 *   3. A rate is not shown until there is enough behind it to mean
 *      something. "0 / 0 = 0%" is not a fact about a DJ.
 */

/** Below this many rows behind it, a percentage is noise, not a finding. */
export const MIN_ROWS_FOR_RATE = 5;

/** An hour-of-day distribution needs enough points to have a shape. */
export const MIN_ROWS_FOR_HOURS = 10;

export type AnalyticsRow = {
  request_status: string;
  stripe_payment_intent_id?: string | null;
  song_title: string | null;
  artist: string | null;
  spotify_track_id?: string | null;
  request_type: string | null;
  is_vip: boolean | null;
  dj_earnings: number | null;
  created_at: string;
};

export type TipRow = { status: string; dj_earnings: number | null };

/*
 * ── Range ────────────────────────────────────────────────────────────
 *
 * A rolling window ending now, not a run of calendar days. Calendar days
 * would drag in the gig-day problem — a set finishing at 2am belongs to
 * the night before, and nothing in the schema models that yet — and a
 * rolling window has no midnight in it to get wrong.
 *
 * Deliberately no Tonight or Today: the dashboard owns the live night,
 * and duplicating it here with a different day boundary is how two
 * screens end up disagreeing about the same gig.
 */
export type RangeKey = "7d" | "30d" | "all";

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "all", label: "All time", days: null },
];

export const DEFAULT_RANGE: RangeKey = "30d";

/** ISO cutoff for the range, or null for all time. Also used to build
 *  the .gte() filter so the database does the slicing, not the browser. */
export function rangeSince(range: RangeKey, now = new Date()): string | null {
  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  if (days === null) return null;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export function rangeLabel(range: RangeKey): string {
  return RANGES.find((r) => r.key === range)?.label ?? "All time";
}

/** How the range reads inside a sentence. */
export function rangeSentence(range: RangeKey): string {
  return range === "all" ? "so far" : `in the last ${rangeLabel(range)}`;
}

/*
 * ── Tracks ───────────────────────────────────────────────────────────
 */

/**
 * Group by Spotify track ID when we have one, otherwise by title and
 * artist together.
 *
 * Title alone was wrong and provably so: one DJ's list showed "Free Your
 * Mind" five times as a single entry when it was two different tracks by
 * two different artists. Adding the artist costs nothing and stops that.
 *
 * The ID is the better key where it exists — it keeps a remix distinct
 * from its original even when both are titled the same — but 87% of rows
 * predate us storing it, including every row belonging to the only DJ
 * who can currently see this page, so the fallback is the common path
 * rather than an edge case. Normalisation is deliberately shallow: case
 * and surrounding whitespace only. Anything cleverer starts guessing
 * that "Levels" and "Levels - Radio Edit" are the same record, and they
 * are not.
 */
const trackKey = (row: AnalyticsRow) =>
  row.spotify_track_id
    ? `id:${row.spotify_track_id}`
    : `text:${(row.song_title ?? "").trim().toLowerCase()}|${(row.artist ?? "")
        .trim()
        .toLowerCase()}`;

export type TrackCount = {
  key: string;
  title: string;
  artist: string | null;
  count: number;
  vipCount: number;
};

export function topTracks(rows: AnalyticsRow[], limit = 5): TrackCount[] {
  const groups = new Map<string, TrackCount>();

  for (const row of rows) {
    if (!row.song_title) continue;

    const key = trackKey(row);
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      if (row.is_vip) existing.vipCount += 1;
      continue;
    }

    groups.set(key, {
      key,
      title: row.song_title,
      artist: row.artist,
      count: 1,
      vipCount: row.is_vip ? 1 : 0,
    });
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/*
 * ── Artist credits ───────────────────────────────────────────────────
 */

/**
 * Spotify stores a track's artists as one comma-joined string, so
 * "Prospa, Cloonee, Sybil" is three credits on one request. Splitting on
 * the comma is how you get back to the artists; not splitting leaves
 * Calvin Harris counted separately from "Calvin Harris, Disciples", which
 * is worse.
 *
 * It is called credits rather than artists on purpose. A featured artist
 * gets the same weight as the lead, and an artist whose own name
 * contains a comma is split in two. Both are acceptable at this
 * precision; neither would be acceptable under a label claiming these
 * are canonical Spotify artists.
 */
export type ArtistCredit = { name: string; count: number };

export function topArtistCredits(
  rows: AnalyticsRow[],
  limit = 5
): ArtistCredit[] {
  const counts = new Map<string, { name: string; count: number }>();

  for (const row of rows) {
    if (!row.artist) continue;

    for (const raw of row.artist.split(",")) {
      const name = raw.trim();
      if (!name) continue;

      const key = name.toLowerCase();
      const existing = counts.get(key);

      if (existing) existing.count += 1;
      else counts.set(key, { name, count: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/*
 * ── Summary ──────────────────────────────────────────────────────────
 */

export type HourBucket = { hour: number; count: number };

export type AnalyticsSummary = {
  /** Requests a guest actually submitted, in range. */
  submitted: number;
  /** Of those, how many the DJ marked as played. Never "played". */
  markedPlayed: number;
  /** Answered one way or the other. The acceptance-rate denominator. */
  decisions: number;
  acceptedOutcomes: number;
  declined: number;
  /** null when there is not enough behind it to be worth a number. */
  acceptanceRate: number | null;
  /** Still waiting on the DJ right now, within the range. */
  awaiting: number;
  songMessage: number;
  songOnly: number;
  /** null below the sample threshold. */
  songMessageRate: number | null;
  vip: number;
  vipRate: number | null;
  /** Stored dj_earnings on earning statuses. Requests only, never tips. */
  fromRequestsPence: number;
  /** Submission time of day, local, 24 buckets. Empty below threshold. */
  hours: HourBucket[];
  busiestHour: number | null;
  topTracks: TrackCount[];
  topArtists: ArtistCredit[];
};

const rate = (part: number, whole: number) =>
  whole >= MIN_ROWS_FOR_RATE ? Math.round((part / whole) * 100) : null;

export function summariseAnalytics(
  allRows: AnalyticsRow[]
): AnalyticsSummary {
  /* The one population rule, applied once. */
  const rows = allRows.filter(isSubmittedRequest);

  const acceptedOutcomes = rows.filter((r) =>
    isAcceptedOutcome(r.request_status)
  ).length;
  const declined = rows.filter((r) => r.request_status === "declined").length;
  /* Same total as acceptedOutcomes + declined, taken from the shared
   * predicate so the denominator cannot drift from the definition. */
  const decisions = rows.filter((r) => isDjDecision(r.request_status)).length;

  const songMessage = rows.filter(
    (r) => r.request_type === "song_message"
  ).length;
  const vip = rows.filter((r) => r.is_vip === true).length;

  /*
   * The same three statuses and the same stored snapshots the earnings
   * page uses. Refunded and disputed rows are accepted outcomes for the
   * decision count above but carry no earnings here, which is exactly
   * how /dj/earnings treats them.
   */
  const fromRequestsPence = rows
    .filter((r) => ["accepted", "playing_next", "played"].includes(r.request_status))
    .reduce((total, r) => total + (r.dj_earnings ?? 0), 0);

  const hourCounts = new Array(24).fill(0) as number[];
  for (const row of rows) hourCounts[new Date(row.created_at).getHours()] += 1;

  const enoughForHours = rows.length >= MIN_ROWS_FOR_HOURS;
  const hours = enoughForHours
    ? hourCounts.map((count, hour) => ({ hour, count }))
    : [];

  let busiestHour: number | null = null;
  if (enoughForHours) {
    const peak = Math.max(...hourCounts);
    busiestHour = peak > 0 ? hourCounts.indexOf(peak) : null;
  }

  return {
    submitted: rows.length,
    markedPlayed: rows.filter((r) => r.request_status === "played").length,
    decisions,
    acceptedOutcomes,
    declined,
    acceptanceRate: rate(acceptedOutcomes, decisions),
    awaiting: rows.filter((r) => r.request_status === "pending").length,
    songMessage,
    songOnly: rows.length - songMessage,
    songMessageRate: rate(songMessage, rows.length),
    vip,
    vipRate: rate(vip, rows.length),
    fromRequestsPence,
    hours,
    busiestHour,
    topTracks: topTracks(rows),
    topArtists: topArtistCredits(rows),
  };
}

/** Succeeded tips only, and only ever as guest behaviour. The schema has
 *  no link between a tip and a request, so nothing here may imply one. */
export function summariseTips(tips: TipRow[]) {
  const succeeded = tips.filter((t) => t.status === "succeeded");
  const total = succeeded.reduce((sum, t) => sum + (t.dj_earnings ?? 0), 0);

  return {
    count: succeeded.length,
    averagePence: succeeded.length
      ? Math.round(total / succeeded.length)
      : null,
  };
}

/** "9pm" rather than "21:00" — this is read mid-thought, in a sentence. */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}
