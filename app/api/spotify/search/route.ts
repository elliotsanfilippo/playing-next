import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";

/*
 * Cached in memory (per server instance) rather than fetched per search.
 * Client-credentials tokens are valid for ~1h; refetching one on every
 * keystroke wastes a round trip and eats into Spotify's own rate limits.
 * Refreshed a minute early to avoid a request landing right on expiry.
 */
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getSpotifyAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const authResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  if (!authResponse.ok) {
    throw new Error(`Spotify auth failed with status ${authResponse.status}`);
  }

  const authData = await authResponse.json();

  if (!authData.access_token) {
    throw new Error("Spotify auth response had no access token");
  }

  cachedToken = {
    accessToken: authData.access_token,
    expiresAt: Date.now() + (authData.expires_in - 60) * 1000,
  };

  return cachedToken.accessToken;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const { allowed, retryAfterSeconds } = rateLimit(
    `spotify-search:${getClientIp(request)}`,
    40,
    60_000
  );

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many searches. Please slow down." },
      { status: 429, headers: { "Retry-After": retryAfterSeconds.toString() } }
    );
  }

  const query = searchParams.get("q")?.slice(0, 200);

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const accessToken = await getSpotifyAccessToken();

    const spotifyResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=track&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!spotifyResponse.ok) {
      /*
       * A stale cached token would fail with 401 — drop it so the next
       * search re-authenticates instead of failing repeatedly.
       */
      if (spotifyResponse.status === 401) {
        cachedToken = null;
      }

      throw new Error(`Spotify search failed with status ${spotifyResponse.status}`);
    }

    const spotifyData = await spotifyResponse.json();

    const tracks =
      spotifyData.tracks?.items?.map((track: any) => ({
        id: track.id,
        title: track.name,
        artist: track.artists.map((artist: any) => artist.name).join(", "),
        artwork: track.album.images?.[0]?.url || null,
        /*
         * Spotify has always returned this; we simply were not mapping
         * it, so the guest had no warning before requesting an explicit
         * track at a wedding or a corporate event. Informational only —
         * nothing filters or blocks on it.
         */
        explicit: Boolean(track.explicit),
      })) || [];

    return NextResponse.json(tracks);
  } catch (error) {
    console.error("Spotify search error:", error);

    return NextResponse.json(
      { error: "Song search is temporarily unavailable. Please try again." },
      { status: 502 }
    );
  }
}
