"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { X, Download } from "lucide-react";
import Button from "@/src/components/ui/Button";
import {
  roundRect,
  wrapSingleLine,
  fillTextTracked,
  drawCornerBrackets,
} from "@/src/lib/canvasArt";

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

const PASS_ACCENT = "#4ade80";
const PASS_BG_TOP = "#0c1210";
const PASS_BG_BOTTOM = "#050605";
const PASS_MUTED = "#71717a";
const PASS_MUTED_LIGHT = "#a1a1aa";

/*
 * Shared look for every printable/wallpaper format: a dark gradient
 * with a soft accent glow, standing in for a premium event pass rather
 * than a plain generated image. glowCenterY lets each format place the
 * glow behind wherever its content actually sits.
 */
function paintPassBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  glowCenterY: number,
  glowRadius: number
) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, PASS_BG_TOP);
  bg.addColorStop(1, PASS_BG_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width / 2,
    glowCenterY,
    40,
    width / 2,
    glowCenterY,
    glowRadius
  );
  glow.addColorStop(0, "rgba(74, 222, 128, 0.16)");
  glow.addColorStop(1, "rgba(74, 222, 128, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawDivider(ctx: CanvasRenderingContext2D, centerX: number, y: number, halfWidth: number) {
  ctx.strokeStyle = "rgba(74, 222, 128, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - halfWidth, y);
  ctx.lineTo(centerX + halfWidth, y);
  ctx.stroke();
}

/*
 * The QR sits inside a two-layer "chip": a thin accent frame with a
 * gap, then a white rounded card the QR itself is drawn onto — reads
 * as a badge/access-pass credential rather than a bare QR image.
 */
function drawQrChip(
  ctx: CanvasRenderingContext2D,
  qrImage: HTMLImageElement,
  qrX: number,
  qrY: number,
  qrSize: number,
  framePad: number,
  chipPad: number
) {
  ctx.strokeStyle = PASS_ACCENT;
  ctx.lineWidth = 2;
  roundRect(
    ctx,
    qrX - framePad,
    qrY - framePad,
    qrSize + framePad * 2,
    qrSize + framePad * 2,
    framePad * 0.7
  );
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  roundRect(
    ctx,
    qrX - chipPad,
    qrY - chipPad,
    qrSize + chipPad * 2,
    qrSize + chipPad * 2,
    chipPad * 0.8
  );
  ctx.fill();

  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
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

  paintPassBackground(ctx, width, height, 460, 640);
  drawCornerBrackets(ctx, 56, 56, width - 112, height - 112, 56, "rgba(74, 222, 128, 0.5)", 2);

  ctx.textAlign = "center";

  ctx.fillStyle = PASS_ACCENT;
  ctx.font = "700 26px system-ui, -apple-system, sans-serif";
  fillTextTracked(ctx, "PLAYING NEXT", width / 2, 190, 6);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 84px system-ui, -apple-system, sans-serif";
  ctx.fillText(wrapSingleLine(ctx, djName, width - 260), width / 2, 300);

  drawDivider(ctx, width / 2, 340, 70);

  const qrSize = 600;
  const qrX = (width - qrSize) / 2;
  const qrY = 460;
  const qrImage = await loadQrImage(requestLink, qrSize);
  drawQrChip(ctx, qrImage, qrX, qrY, qrSize, 50, 30);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 42px system-ui, -apple-system, sans-serif";
  ctx.fillText("Scan to request a song", width / 2, qrY + qrSize + 110);

  ctx.fillStyle = PASS_MUTED;
  ctx.font = "500 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(shortLink(requestLink), width / 2, height - 90);
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

  paintPassBackground(ctx, width, height, 380, 660);
  drawCornerBrackets(ctx, 50, 50, width - 100, height - 100, 60, "rgba(74, 222, 128, 0.5)", 2);

  ctx.textAlign = "center";

  ctx.fillStyle = PASS_ACCENT;
  ctx.font = "700 30px system-ui, -apple-system, sans-serif";
  fillTextTracked(ctx, "SCAN TO REQUEST A SONG", width / 2, 180, 5);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 92px system-ui, -apple-system, sans-serif";
  ctx.fillText(wrapSingleLine(ctx, djName, width - 160), width / 2, 300);

  drawDivider(ctx, width / 2, 340, 80);

  const qrSize = 700;
  const qrX = (width - qrSize) / 2;
  const qrY = 430;
  const qrImage = await loadQrImage(requestLink, qrSize);
  drawQrChip(ctx, qrImage, qrX, qrY, qrSize, 54, 32);

  ctx.fillStyle = PASS_MUTED_LIGHT;
  ctx.font = "600 36px system-ui, -apple-system, sans-serif";
  ctx.fillText("Point your camera at the code", width / 2, qrY + qrSize + 110);

  ctx.fillStyle = PASS_MUTED;
  ctx.font = "500 26px system-ui, -apple-system, sans-serif";
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

  const centerY = height * 0.46;
  paintPassBackground(ctx, width, height, centerY, 700);

  ctx.textAlign = "center";

  ctx.fillStyle = PASS_ACCENT;
  ctx.font = "700 26px system-ui, -apple-system, sans-serif";
  fillTextTracked(ctx, "PLAYING NEXT", width / 2, centerY - 70, 6);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 58px system-ui, -apple-system, sans-serif";
  ctx.fillText(wrapSingleLine(ctx, djName, width - 160), width / 2, centerY);

  drawDivider(ctx, width / 2, centerY + 30, 50);

  const qrSize = 340;
  const qrX = (width - qrSize) / 2;
  const qrY = centerY + 90;
  const qrImage = await loadQrImage(requestLink, qrSize);
  drawQrChip(ctx, qrImage, qrX, qrY, qrSize, 34, 20);

  ctx.fillStyle = PASS_MUTED;
  ctx.font = "500 24px system-ui, -apple-system, sans-serif";
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
