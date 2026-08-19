export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export function wrapSingleLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let truncated = text;
  while (
    truncated.length > 0 &&
    ctx.measureText(`${truncated}…`).width > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

/*
 * Canvas has no letter-spacing property, so tracked uppercase labels
 * (the small eyebrow/CTA style used across the site's CSS) are faked by
 * measuring and drawing one character at a time. ctx.textAlign is
 * respected for the block as a whole; only "left" and "center" make
 * sense as inputs here.
 */
export function fillTextTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  letterSpacing: number
) {
  const widths = [...text].map((char) => ctx.measureText(char).width);
  const totalWidth =
    widths.reduce((sum, w) => sum + w, 0) + letterSpacing * (text.length - 1);

  const originalAlign = ctx.textAlign;
  ctx.textAlign = "left";

  let x = centerX - totalWidth / 2;
  [...text].forEach((char, index) => {
    ctx.fillText(char, x, y);
    x += widths[index] + letterSpacing;
  });

  ctx.textAlign = originalAlign;
}

/*
 * Four small L-shaped corner marks, like a ticket or access-pass
 * registration mark — reused across the print/wallpaper QR formats to
 * read as a premium physical pass rather than a plain generated image.
 */
export function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  armLength: number,
  color: string,
  lineWidth: number
) {
  const corners: Array<[number, number, number, number]> = [
    [x, y, 1, 1],
    [x + width, y, -1, 1],
    [x, y + height, 1, -1],
    [x + width, y + height, -1, -1],
  ];

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "square";

  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + armLength * dy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + armLength * dx, cy);
    ctx.stroke();
  });
}
