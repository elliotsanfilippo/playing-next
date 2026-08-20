/*
 * Track data for the homepage story.
 *
 * Organised strictly by scene, because the story only reads as one
 * continuous night if no song appears twice — a repeated title makes
 * the whole thing look like a loop of placeholder data. Amounts are in
 * pence, matching how the real product stores every value.
 *
 * Scene ownership:
 *   OPENING_*    the request the visitor accepts, and the compact
 *                dashboard it lands in
 *   DASHBOARD_*  the full "Your booth. Your call." dashboard — a
 *                completely separate set, so scrolling from the
 *                opening into the dashboard doesn't replay the same
 *                four tracks
 *   GUEST_*      the crowd's side. A single recognisable artist
 *                searched by name, so the scene reads instantly as
 *                "I'm searching an artist and picking a song".
 *
 * assertUniqueTracks() below fails loudly in development if these sets
 * ever overlap again.
 */

export type StoryTrack = {
  id: string;
  title: string;
  artist: string;
  pence: number;
};

/* ── Scene 1: the opening ──────────────────────────────────────── */

export const OPENING_REQUEST: StoryTrack = {
  id: "opening-levels",
  title: "Levels",
  artist: "Avicii",
  pence: 500,
};

export const OPENING_PLAYING_NEXT: StoryTrack = {
  id: "opening-praise-you",
  title: "Praise You",
  artist: "Fatboy Slim",
  pence: 800,
};

export const OPENING_QUEUE: StoryTrack[] = [
  { id: "oq-free-your-mind", title: "Free Your Mind", artist: "Prospa", pence: 500 },
  { id: "oq-feel-so-close", title: "Feel So Close", artist: "Calvin Harris", pence: 500 },
  { id: "oq-one-more-time", title: "One More Time", artist: "Daft Punk", pence: 800 },
];

/* ── Scene 2: the full dashboard ───────────────────────────────── */

export const DASHBOARD_PLAYING_NEXT: StoryTrack = {
  id: "dash-insomnia",
  title: "Insomnia",
  artist: "Faithless",
  pence: 700,
};

export const DASHBOARD_QUEUE: StoryTrack[] = [
  { id: "dq-show-me-love", title: "Show Me Love", artist: "Robin S", pence: 500 },
  { id: "dq-rhythm-is-a-dancer", title: "Rhythm Is a Dancer", artist: "SNAP!", pence: 600 },
  { id: "dq-music-sounds-better", title: "Music Sounds Better With You", artist: "Stardust", pence: 800 },
];

/* ── Scene 4: the crowd's side ─────────────────────────────────── */

/** What the guest types — an artist name, not a track, so the step
 *  reads as "search an artist, choose a song". */
export const GUEST_SEARCH_QUERY = "Rihanna";

export const GUEST_SEARCH_RESULTS: StoryTrack[] = [
  { id: "g-umbrella", title: "Umbrella", artist: "Rihanna", pence: 500 },
  { id: "g-we-found-love", title: "We Found Love", artist: "Rihanna", pence: 500 },
  { id: "g-only-girl", title: "Only Girl (In The World)", artist: "Rihanna", pence: 500 },
];

/** The one they pick — always the first result, so the highlighted row
 *  and the review screen agree. */
export const GUEST_REQUEST: StoryTrack = GUEST_SEARCH_RESULTS[0];

/* ── Guard ─────────────────────────────────────────────────────── */

/*
 * Dev-only check that the scenes stay disjoint. Runs at module load so
 * a duplicate shows up the moment the homepage renders, rather than
 * being spotted by eye in review.
 */
function assertUniqueTracks() {
  const all = [
    OPENING_REQUEST,
    OPENING_PLAYING_NEXT,
    ...OPENING_QUEUE,
    DASHBOARD_PLAYING_NEXT,
    ...DASHBOARD_QUEUE,
    ...GUEST_SEARCH_RESULTS,
  ];

  const seen = new Map<string, string>();
  for (const track of all) {
    const key = `${track.title.toLowerCase()} — ${track.artist.toLowerCase()}`;
    if (seen.has(key)) {
      console.error(
        `[storyData] "${track.title}" by ${track.artist} is used more than once ` +
          `(${seen.get(key)} and ${track.id}). Every homepage scene must use a ` +
          `distinct set of tracks.`
      );
    }
    seen.set(key, track.id);
  }
}

if (process.env.NODE_ENV !== "production") {
  assertUniqueTracks();
}
