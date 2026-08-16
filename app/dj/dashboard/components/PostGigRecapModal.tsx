"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { X, Share2 } from "lucide-react";
import Button from "@/src/components/ui/Button";
import type { SongRequest } from "@/src/types/dashboard";
import { roundRect, wrapSingleLine } from "@/src/lib/canvasArt";

type Props = {
  djName: string;
  djSlug: string;
  sessionRequests: SongRequest[];
  onDismiss: () => Promise<void>;
};

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

/*
 * Shown once a DJ's session ends (paused manually or auto-closed) as
 * long as at least one request went through — a shareable recap card,
 * drawn straight onto a <canvas> at Instagram Story dimensions so the
 * on-screen preview and the downloaded PNG are always identical.
 */
export default function PostGigRecapModal({
  djName,
  djSlug,
  sessionRequests,
  onDismiss,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dismissing, setDismissing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [ready, setReady] = useState(false);

  const songCounts = new Map<
    string,
    { title: string; artist: string; count: number }
  >();

  sessionRequests.forEach((request) => {
    const key = `${request.song_title}|||${request.artist}`;
    const existing = songCounts.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      songCounts.set(key, {
        title: request.song_title,
        artist: request.artist,
        count: 1,
      });
    }
  });

  const topSong = [...songCounts.values()].sort(
    (a, b) => b.count - a.count
  )[0];
  const showTopSong = Boolean(topSong && topSong.count >= 2);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let cancelled = false;

    const draw = async () => {
      canvas.width = CARD_WIDTH;
      canvas.height = CARD_HEIGHT;

      const bgGradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
      bgGradient.addColorStop(0, "#0c1210");
      bgGradient.addColorStop(1, "#070809");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

      const glow = ctx.createRadialGradient(
        CARD_WIDTH / 2,
        260,
        40,
        CARD_WIDTH / 2,
        260,
        700
      );
      glow.addColorStop(0, "rgba(74, 222, 128, 0.18)");
      glow.addColorStop(1, "rgba(74, 222, 128, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

      ctx.textAlign = "center";

      ctx.fillStyle = "#4ade80";
      ctx.font = "600 32px system-ui, -apple-system, sans-serif";
      ctx.fillText("PLAYING NEXT", CARD_WIDTH / 2, 140);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 76px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        wrapSingleLine(ctx, djName, CARD_WIDTH - 160),
        CARD_WIDTH / 2,
        250
      );

      ctx.fillStyle = "#a1a1aa";
      ctx.font = "600 34px system-ui, -apple-system, sans-serif";
      ctx.fillText("TONIGHT'S RECAP", CARD_WIDTH / 2, 310);

      ctx.fillStyle = "#4ade80";
      ctx.font = "800 340px system-ui, -apple-system, sans-serif";
      ctx.fillText(String(sessionRequests.length), CARD_WIDTH / 2, 820);

      ctx.fillStyle = "#ffffff";
      ctx.font = "700 48px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        sessionRequests.length === 1 ? "REQUEST PLAYED" : "REQUESTS PLAYED",
        CARD_WIDTH / 2,
        900
      );

      if (showTopSong && topSong) {
        const cardMargin = 90;
        const cardY = 1020;
        const cardHeight = 220;
        const cardWidth = CARD_WIDTH - cardMargin * 2;

        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 2;
        roundRect(ctx, cardMargin, cardY, cardWidth, cardHeight, 28);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#4ade80";
        ctx.font = "600 30px system-ui, -apple-system, sans-serif";
        ctx.fillText("MOST REQUESTED", CARD_WIDTH / 2, cardY + 60);

        ctx.fillStyle = "#ffffff";
        ctx.font = "700 44px system-ui, -apple-system, sans-serif";
        ctx.fillText(
          wrapSingleLine(ctx, topSong.title, cardWidth - 80),
          CARD_WIDTH / 2,
          cardY + 120
        );

        ctx.fillStyle = "#a1a1aa";
        ctx.font = "500 32px system-ui, -apple-system, sans-serif";
        ctx.fillText(
          wrapSingleLine(ctx, topSong.artist, cardWidth - 80),
          CARD_WIDTH / 2,
          cardY + 175
        );
      }

      const qrDataUrl = await QRCode.toDataURL(
        `${window.location.origin}/request/${djSlug}`,
        { margin: 1, width: 300 }
      );

      if (cancelled) return;

      const qrImage = new Image();
      await new Promise<void>((resolve) => {
        qrImage.onload = () => resolve();
        qrImage.src = qrDataUrl;
      });

      if (cancelled) return;

      const qrSize = 260;
      const qrX = (CARD_WIDTH - qrSize) / 2;
      const qrY = 1480;

      ctx.fillStyle = "#ffffff";
      roundRect(ctx, qrX - 24, qrY - 24, qrSize + 48, qrSize + 48, 24);
      ctx.fill();
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 36px system-ui, -apple-system, sans-serif";
      ctx.fillText("Scan to request a song", CARD_WIDTH / 2, qrY + qrSize + 80);

      ctx.fillStyle = "#71717a";
      ctx.font = "500 28px system-ui, -apple-system, sans-serif";
      ctx.fillText("playingnextapp.com", CARD_WIDTH / 2, CARD_HEIGHT - 60);

      if (!cancelled) setReady(true);
    };

    draw();

    return () => {
      cancelled = true;
    };
  }, [djName, djSlug, sessionRequests, showTopSong, topSong]);

  const getCanvasBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });

  /*
   * The classic <a download> trick doesn't reliably save anything on
   * mobile Safari, which is where most DJs would actually be tapping
   * this. Web Share API with a file opens the native share sheet
   * instead (straight to Instagram/Messages/Photos), so it's tried
   * first; the download link is only a fallback for browsers that
   * don't support sharing files (most desktop browsers).
   */
  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);

    try {
      const blob = await getCanvasBlob();
      if (!blob) return;

      const file = new File([blob], `${djSlug}-recap.png`, {
        type: "image/png",
      });

      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: "My night on Playing Next",
          });
          return;
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return;
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${djSlug}-recap.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setSharing(false);
    }
  };

  const handleDismiss = async () => {
    if (dismissing) return;

    setDismissing(true);
    try {
      await onDismiss();
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-card-lg border border-white/10 bg-zinc-950 p-5 shadow-2xl">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-zinc-400 backdrop-blur transition hover:text-white disabled:opacity-50"
        >
          <X size={16} />
        </button>

        <p className="mb-4 pr-10 text-sm text-zinc-400">
          Nice set! Here&apos;s your night in numbers. Share it if
          you&apos;re proud of it.
        </p>

        <div className="overflow-hidden rounded-control border border-white/10 bg-black">
          <canvas ref={canvasRef} className="h-auto w-full" />
        </div>

        <div className="mt-4 flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleDismiss}
            disabled={dismissing}
          >
            {dismissing ? "Closing..." : "Maybe later"}
          </Button>

          <Button
            className="flex-1"
            onClick={handleShare}
            disabled={!ready || sharing}
          >
            <Share2 size={14} className="mr-1.5" />
            {sharing ? "Sharing..." : "Share"}
          </Button>
        </div>
      </div>
    </div>
  );
}
