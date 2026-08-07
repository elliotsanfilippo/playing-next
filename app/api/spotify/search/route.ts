import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";

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

  const authResponse = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString("base64"),
      },
      body: "grant_type=client_credentials",
    }
  );

  const authData = await authResponse.json();

  const accessToken = authData.access_token;

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

  const spotifyData = await spotifyResponse.json();

  const tracks =
    spotifyData.tracks?.items?.map((track: any) => ({
      id: track.id,
      title: track.name,
      artist: track.artists
        .map((artist: any) => artist.name)
        .join(", "),
      artwork:
        track.album.images?.[0]?.url || null,
    })) || [];

  return NextResponse.json(tracks);
}