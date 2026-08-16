"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { X, Download } from "lucide-react";
import Button from "@/src/components/ui/Button";
import { roundRect, wrapSingleLine } from "@/src/lib/canvasArt";

type Format = "table" | "booth" | "lockscreen";

type Props = {
  djName: string;
  djSlug: string;
  requestLink: string;
  onClose: () => void;
};

const FORMAT_META: Record<
  Format,
  { label: string; description: string; fileSuffix: string }
> = {
  table: {
    label: "Table Card",
    description: "A print-ready card for tables, booths or the DJ stand.",
    fileSuffix: "table-card",
  },
  booth: {
    label: "Booth Sign",
    description: "A bold A4 poster to print and display near the booth.",
    fileSuffix: "booth-sign",
  },
  lockscreen: {
    label: "Lock Screen",
    description: "A phone wallpaper so guests can scan it off your lock screen.",
    fileSuffix: "lock-screen",
  },
};

function shortLink(requestLink: string) {
  return requestLink.replace(/^https?:\/\//, "");
}

async function loadQrImage(requestLink: string, size: number) {
  const dataUrl = await QRCode.toDataURL(requestLink, { margin: 1, width: size });
  const image = new Image();
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.src = dataUrl;
  });
  return image;
}

async function drawTableCard(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  djName: string,
  requestLink: string
) {
  const width = 1200;
  const height = 1800;
  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#f7f7f5";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(9, 15, 12, 0.14)";
  ctx.lineWidth = 3;
  roundRect(ctx, 44, 44, width - 88, height - 88, 32);
  ctx.stroke();

  ctx.textAlign = "center";

  ctx.fillStyle = "#16a34a";
  ctx.font = "700 30px system-ui, -apple-system, sans-serif";
  ctx.fillText("PLAYING NEXT", width / 2, 165);

  ctx.fillStyle = "#0b0f0d";
  ctx.font = "800 70px system-ui, -apple-system, sans-serif";
  ctx.fillText(wrapSingleLine(ctx, djName, width - 200), width / 2, 260);

  ctx.fillStyle = "#3f3f46";
  ctx.font = "600 34px system-ui, -apple-system, sans-serif";
  ctx.fillText("Scan to request a song", width / 2, 320);

  const qrSize = 680;
  const qrImage = await loadQrImage(requestLink, qrSize);
  const qrX = (width - qrSize) / 2;
  const qrY = 420;
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = "#71717a";
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(shortLink(requestLink), width / 2, qrY + qrSize + 80);
}

async function drawBoothSign(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  djName: string,
  requestLink: string
) {
  const width = 1240;
  const height = 1754;
  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";

  ctx.fillStyle = "#16a34a";
  ctx.font = "800 52px system-ui, -apple-system, sans-serif";
  ctx.fillText("SCAN TO REQUEST A SONG", width / 2, 170);

  ctx.fillStyle = "#0b0f0d";
  ctx.font = "800 86px system-ui, -apple-system, sans-serif";
  ctx.fillText(wrapSingleLine(ctx, djName, width - 160), width / 2, 290);

  const qrSize = 820;
  const qrImage = await loadQrImage(requestLink, qrSize);
  const qrX = (width - qrSize) / 2;
  const qrY = 380;
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = "#3f3f46";
  ctx.font = "600 40px system-ui, -apple-system, sans-serif";
  ctx.fillText("Point your camera at the code", width / 2, qrY + qrSize + 74);

  ctx.fillStyle = "#a1a1aa";
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(shortLink(requestLink), width / 2, height - 60);
}

async function drawLockScreen(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  djName: string,
  requestLink: string
) {
  const width = 1080;
  const height = 1920;
  canvas.width = width;
  canvas.height = height;

  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, "#0c1210");
  bgGradient.addColorStop(1, "#070809");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  const centerY = height * 0.44;

  const glow = ctx.createRadialGradient(
    width / 2,
    centerY,
    40,
    width / 2,
    centerY,
    700
  );
  glow.addColorStop(0, "rgba(74, 222, 128, 0.16)");
  glow.addColorStop(1, "rgba(74, 222, 128, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";

  ctx.fillStyle = "#4ade80";
  ctx.font = "600 30px system-ui, -apple-system, sans-serif";
  ctx.fillText("PLAYING NEXT", width / 2, centerY - 60);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 60px system-ui, -apple-system, sans-serif";
  ctx.fillText(wrapSingleLine(ctx, djName, width - 160), width / 2, centerY + 10);

  ctx.fillStyle = "#a1a1aa";
  ctx.font = "600 32px system-ui, -apple-system, sans-serif";
  ctx.fillText("Scan to request a song", width / 2, centerY + 65);

  const qrSize = 380;
  const qrImage = await loadQrImage(requestLink, qrSize);
  const qrX = (width - qrSize) / 2;
  const qrY = centerY + 120;

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, qrX - 28, qrY - 28, qrSize + 56, qrSize + 56, 28);
  ctx.fill();
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = "#71717a";
  ctx.font = "500 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(shortLink(requestLink), width / 2, qrY + qrSize + 90);
}

const DRAWERS: Record<
  Format,
  (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    djName: string,
    requestLink: string
  ) => Promise<void>
> = {
  table: drawTableCard,
  booth: drawBoothSign,
  lockscreen: drawLockScreen,
};

/*
 * Reuses the canvas-composited PNG approach from PostGigRecapModal so a
 * DJ can get a print-ready or wallpaper-ready version of the same QR
 * code that's already on their dashboard, without needing a design tool.
 */
export default function QRFormatsModal({
  djName,
  djSlug,
  requestLink,
  onClose,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<Format>("table");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !requestLink) return;

    let cancelled = false;
    setReady(false);

    DRAWERS[format](ctx, canvas, djName, requestLink).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [format, djName, requestLink]);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((result) => resolve(result), "image/png")
      );
      if (!blob) return;

      const filename = `${djSlug}-${FORMAT_META[format].fileSuffix}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file], title: FORMAT_META[format].label });
          return;
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return;
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-card-lg border border-white/10 bg-zinc-950 p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-zinc-400 backdrop-blur transition hover:text-white"
        >
          <X size={16} />
        </button>

        <h2 className="pr-10 text-h3">Print &amp; wallpaper formats</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {FORMAT_META[format].description}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {(Object.keys(FORMAT_META) as Format[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormat(key)}
              className={`rounded-control border px-3 py-2 text-xs font-semibold transition ${
                format === key
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
              }`}
            >
              {FORMAT_META[key].label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex h-[380px] items-center justify-center overflow-hidden rounded-control border border-white/10 bg-black p-3">
          <canvas ref={canvasRef} className="h-full w-auto object-contain" />
        </div>

        <Button
          className="mt-4 w-full"
          onClick={handleDownload}
          disabled={!ready || busy}
        >
          <Download size={16} className="mr-1.5" />
          {busy ? "Preparing..." : `Download ${FORMAT_META[format].label}`}
        </Button>
      </div>
    </div>
  );
}
