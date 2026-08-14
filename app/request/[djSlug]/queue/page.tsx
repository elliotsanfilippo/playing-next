"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { Music2, Radio, Crown, ArrowLeft } from "lucide-react";
import Eyebrow from "@/src/components/ui/Eyebrow";

type QueueTrack = {
  songTitle: string;
  artist: string;
  isMessage: boolean;
  isVip: boolean;
};

type QueueData = {
  djName: string;
  djImage: string | null;
  isLive: boolean;
  nowPlaying: QueueTrack | null;
  upNext: QueueTrack[];
};

/*
 * Fully public, no auth, meant to be left open on a screen at the venue
 * — hence the large type and minimal chrome rather than the app's usual
 * dashboard density. Polls every 4s, same guest-safe pattern as the
 * rest of the guest flow (no realtime, since there's no way to
 * authenticate a public display as "allowed to see this DJ's queue").
 */
export default function PublicQueuePage() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  const [data, setData] = useState<QueueData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  useEffect(() => {
    if (!djSlug) return;

    const requestLink = `${window.location.origin}/request/${djSlug}`;

    QRCode.toDataURL(requestLink, { margin: 1 })
      .then(setQrCodeUrl)
      .catch((error) => console.log("QR code error:", error));
  }, [djSlug]);

  useEffect(() => {
    let isMounted = true;

    const fetchQueue = async () => {
      const response = await fetch(`/api/queue/${djSlug}`);

      if (!isMounted) return;

      if (!response.ok) {
        setNotFound(true);
        return;
      }

      setData(await response.json());
      setNotFound(false);
    };

    fetchQueue();

    const interval = setInterval(fetchQueue, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [djSlug]);

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-6 text-white">
        <p className="text-zinc-400">This DJ&apos;s queue isn&apos;t available.</p>

        <Link
          href="/dj/dashboard"
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft size={12} />
          Back to Dashboard
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-white">
        <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-canvas px-6 py-8 text-white sm:px-10 sm:py-10">
      <Link
        href="/dj/dashboard"
        className="fixed left-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-zinc-500 backdrop-blur transition hover:text-zinc-300"
      >
        <ArrowLeft size={12} />
        Dashboard
      </Link>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-4">
            {data.djImage ? (
              <img
                src={data.djImage}
                alt={data.djName}
                className="h-14 w-14 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-xl font-bold text-zinc-400">
                {data.djName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div>
              <Eyebrow tone="accent">Playing Next</Eyebrow>
              <h1 className="mt-1 text-2xl font-bold">{data.djName}</h1>
            </div>
          </div>

          {data.isLive && (
            <div className="flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
              <Radio size={16} />
              Live
            </div>
          )}
        </div>

        <div className="mt-10 shrink-0 sm:mt-12">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Now Playing
          </p>

          {data.nowPlaying ? (
            <div className="mt-4">
              {data.nowPlaying.isVip && (
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-sm font-semibold text-amber-300">
                  <Crown size={16} /> VIP
                </div>
              )}
              <h2 className="text-5xl font-bold leading-tight sm:text-7xl">
                {data.nowPlaying.songTitle}
              </h2>
              <p className="mt-3 text-2xl text-zinc-400 sm:text-3xl">
                {data.nowPlaying.artist}
              </p>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 text-2xl text-zinc-600">
              <Music2 size={28} />
              Nothing playing right now
            </div>
          )}
        </div>

        <div className="mt-10 flex min-h-0 flex-1 flex-col sm:mt-12">
          <p className="shrink-0 text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Up Next
          </p>

          {data.upNext.length === 0 ? (
            <p className="mt-4 text-lg text-zinc-600">
              The queue is empty. Get your request in.
            </p>
          ) : (
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pb-44 pr-1 sm:pr-52">
              {data.upNext.map((track, index) => (
                <div
                  key={`${track.songTitle}-${index}`}
                  className={`flex items-center gap-5 rounded-card border px-6 py-5 ${
                    track.isVip
                      ? "border-amber-400/30 bg-amber-400/5"
                      : "border-white/10 bg-zinc-900/70"
                  }`}
                >
                  <span
                    className={`text-2xl font-bold ${
                      track.isVip ? "text-amber-400" : "text-zinc-600"
                    }`}
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-xl font-semibold">
                      {track.isVip && (
                        <Crown size={18} className="shrink-0 text-amber-400" />
                      )}
                      {track.songTitle}
                    </p>
                    <p className="truncate text-zinc-500">{track.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {qrCodeUrl && (
        <div className="fixed bottom-6 right-6 flex items-center gap-4 rounded-card-lg border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur">
          <div className="rounded-card bg-white p-2">
            <img src={qrCodeUrl} alt="QR code" className="h-24 w-24" />
          </div>

          <p className="max-w-[9rem] text-sm font-semibold leading-tight text-zinc-300">
            Scan to request a song
          </p>
        </div>
      )}
    </main>
  );
}
