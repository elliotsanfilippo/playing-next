/*
 * Track data for the homepage story.
 *
 * Kept in one place so no song appears twice across the narrative —
 * a repeated title makes the demo read as a loop of fake data rather
 * than one continuous night. Amounts are in pence, matching how the
 * real product stores every value.
 *
 * Split by scene:
 *   OPENING_REQUEST     the request the visitor accepts
 *   SCENE_PLAYING_NEXT  currently cued — never also in the queue
 *   SCENE_QUEUE         the accepted queue behind it
 *   GUEST_*             the guest-side flow, distinct again so the
 *                       crowd's view doesn't mirror the DJ's
 */

export type StoryTrack = {
  id: string;
  title: string;
  artist: string;
  pence: number;
};

export const OPENING_REQUEST: StoryTrack = {
  id: "opening-levels",
  title: "Levels",
  artist: "Avicii",
  pence: 500,
};

export const SCENE_PLAYING_NEXT: StoryTrack = {
  id: "playing-praise-you",
  title: "Praise You",
  artist: "Fatboy Slim",
  pence: 800,
};

export const SCENE_QUEUE: StoryTrack[] = [
  { id: "q-free-your-mind", title: "Free Your Mind", artist: "Prospa", pence: 500 },
  { id: "q-feel-so-close", title: "Feel So Close", artist: "Calvin Harris", pence: 500 },
  { id: "q-one-more-time", title: "One More Time", artist: "Daft Punk", pence: 800 },
];

/** The track a guest searches for and sends — distinct from every
 *  song on the DJ side so the two views never look like copies. */
export const GUEST_REQUEST: StoryTrack = {
  id: "guest-teardrop",
  title: "Teardrop",
  artist: "Massive Attack",
  pence: 500,
};

export const GUEST_SEARCH_RESULTS: StoryTrack[] = [
  GUEST_REQUEST,
  { id: "guest-angel", title: "Angel", artist: "Massive Attack", pence: 500 },
  { id: "guest-unfinished", title: "Unfinished Sympathy", artist: "Massive Attack", pence: 500 },
];
