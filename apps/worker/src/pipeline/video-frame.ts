import sharp from "sharp";

import type { SlideAppearance, VideoStyle } from "@workspace/generation";

/**
 * Render the video frames for a step. Composition is done with sharp: a static
 * base (browser chrome + screenshot + caption) plus a short sequence of "intro"
 * frames in which the click-pointer glides in from the previous step's target
 * and pulses on landing. The compositor holds the last intro frame for the rest
 * of the step, so audio stays continuous and only ~1s of frames is rendered.
 *
 * We render on the server (no DOM) to match the walkthrough look; the pointer,
 * pulse, and accent use the guide's resolved brand color + hotspot type.
 *
 * Everything is authored in a 1280×720 design space scaled up by SCALE, so the
 * output is 1080p — screenshots downscale far less than at 720p, keeping text
 * crisp.
 */

const SCALE = 1.5;
export const FRAME_W = Math.round(1280 * SCALE); // 1920
export const FRAME_H = Math.round(720 * SCALE); // 1080
export const FPS = 30;

const CHROME_H = Math.round(44 * SCALE);
const CAPTION_MAX_H = Math.round(132 * SCALE);
const CAPTION_PAD_X = Math.round(56 * SCALE);
const CAPTION_FONT = Math.round(27 * SCALE);
const CAPTION_LINE_H = Math.round(38 * SCALE);
const CAPTION_MAX_LINES = 3;
const BG = "#0e1116"; // ink — letterbox / chrome ground

// Intro animation: cursor travels in, then a landing pulse.
const TRAVEL_FRAMES = 21; // ~0.7s glide
const PULSE_FRAMES = 15; // ~0.5s pulse
export const INTRO_FRAMES = TRAVEL_FRAMES + PULSE_FRAMES;
export const INTRO_SEC = INTRO_FRAMES / FPS;

type ClickRect = { x: number; y: number; w: number; h: number } | null;
export type Point = { x: number; y: number };

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Greedy word-wrap by approximate glyph width. `avg` is the em-fraction of an
 *  average glyph advance (~0.5 serif, ~0.52 sans). Clamps to `maxLines`. */
function wrapText(
  text: string,
  fontPx: number,
  maxWidth: number,
  avg: number,
  maxLines: number
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const maxChars = Math.max(8, Math.floor(maxWidth / (fontPx * avg)));
  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/[.,;:]?$/, "")}…`;
  }
  return lines;
}

/** Relative luminance (0–1) of a #rgb / #rrggbb color, for text contrast. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  let h = m[1]!;
  if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Greedy word-wrap tuned to the caption font/width; clamps to a few lines. */
function wrapCaption(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // ~0.52em average glyph advance for the UI stack at CAPTION_FONT px.
  const maxChars = Math.floor(
    (FRAME_W - CAPTION_PAD_X * 2) / (CAPTION_FONT * 0.52)
  );
  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > CAPTION_MAX_LINES) {
    lines.length = CAPTION_MAX_LINES;
    lines[CAPTION_MAX_LINES - 1] = `${lines[CAPTION_MAX_LINES - 1]!.replace(/[.,;:]?$/, "")}…`;
  }
  return lines;
}

/** Highlight-box outline around the target rect (frame pixels). */
function highlightBoxSvg(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  color: string
): string {
  const c = escapeXml(color);
  const pad = 6 * SCALE;
  return `<rect x="${rx - pad}" y="${ry - pad}" width="${rw + pad * 2}" height="${rh + pad * 2}"
    rx="${8 * SCALE}" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="${3 * SCALE}"/>`;
}

/** The click-pointer glyph SVG at (x,y) in frame pixels, scaled by `gs`. For a
 *  cursor, (x,y) is the tip; for reticle/circle it's the center. */
function pointerGlyph(style: VideoStyle, x: number, y: number, gs: number): string {
  const c = escapeXml(style.brandColor);
  if (style.hotspotType === "cursor") {
    return `<g transform="translate(${x} ${y}) scale(${gs})">
      <path d="M0 0 L0 26 L7 19 L12 30 L16 28 L11 17 L20 17 Z"
        fill="${c}" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></g>`;
  }
  const r1 = 26 * gs;
  const r2 = 14 * gs;
  const r3 = 5 * gs;
  return `<g>
    <circle cx="${x}" cy="${y}" r="${r1}" fill="${c}" fill-opacity="0.18"/>
    <circle cx="${x}" cy="${y}" r="${r1}" fill="none" stroke="${c}" stroke-width="${3 * gs}" stroke-opacity="0.9"/>
    <circle cx="${x}" cy="${y}" r="${r2}" fill="none" stroke="${c}" stroke-width="${2.5 * gs}" stroke-opacity="0.95"/>
    <circle cx="${x}" cy="${y}" r="${r3}" fill="${c}" stroke="#ffffff" stroke-width="${2 * gs}"/></g>`;
}

/**
 * The base frame (1920×1080 PNG): screenshot in a browser-chrome frame with a
 * caption bar. For the `highlight-box` hotspot the region outline is baked in
 * (a box, not a traveling cursor) and `target` is null; for point-style
 * hotspots `target` is the click point in frame pixels (pointer drawn later).
 */
export async function renderStepBase(
  screenshot: Uint8Array,
  opts: { clickRect: ClickRect; caption: string; style: VideoStyle }
): Promise<{ png: Buffer; target: Point | null }> {
  const { clickRect, caption, style } = opts;
  const meta = await sharp(screenshot).metadata();
  const imgW = meta.width ?? FRAME_W;
  const imgH = meta.height ?? FRAME_H;

  const captionLines = wrapCaption(caption);
  const captionH =
    captionLines.length > 0
      ? Math.min(CAPTION_MAX_H, captionLines.length * CAPTION_LINE_H + 28 * SCALE)
      : 0;

  // Content area: below the chrome bar, above the caption bar.
  const areaTop = CHROME_H;
  const areaH = FRAME_H - CHROME_H - captionH;
  const scale = Math.min(FRAME_W / imgW, areaH / imgH);
  const sw = Math.max(1, Math.round(imgW * scale));
  const sh = Math.max(1, Math.round(imgH * scale));
  const sx = Math.round((FRAME_W - sw) / 2);
  const sy = Math.round(areaTop + (areaH - sh) / 2);

  const shot = await sharp(screenshot)
    .resize(sw, sh, { kernel: "lanczos3" })
    .png()
    .toBuffer();

  const overlayParts: string[] = [];
  // Browser chrome bar.
  const dot = (cx: number) =>
    `<circle cx="${cx * SCALE}" cy="${CHROME_H / 2}" r="${6 * SCALE}"`;
  overlayParts.push(
    `<rect x="0" y="0" width="${FRAME_W}" height="${CHROME_H}" fill="#1b2028"/>`,
    `${dot(22)} fill="#ff5f57"/>`,
    `${dot(44)} fill="#febc2e"/>`,
    `${dot(66)} fill="#28c840"/>`,
    `<rect x="${92 * SCALE}" y="${CHROME_H / 2 - 9 * SCALE}" width="${FRAME_W - 130 * SCALE}" height="${18 * SCALE}" rx="${9 * SCALE}" fill="#2b313b"/>`
  );

  let target: Point | null = null;
  if (clickRect) {
    const rx = sx + clickRect.x * sw;
    const ry = sy + clickRect.y * sh;
    const rw = clickRect.w * sw;
    const rh = clickRect.h * sh;
    if (style.hotspotType === "highlight-box") {
      overlayParts.push(highlightBoxSvg(rx, ry, rw, rh, style.brandColor));
    } else {
      target = { x: Math.round(rx + rw / 2), y: Math.round(ry + rh / 2) };
    }
  }

  // Caption bar (subtitles).
  if (captionH > 0) {
    const barTop = FRAME_H - captionH;
    overlayParts.push(
      `<rect x="0" y="${barTop}" width="${FRAME_W}" height="${captionH}" fill="#0a0d12" fill-opacity="0.9"/>`,
      `<rect x="0" y="${barTop}" width="${4 * SCALE}" height="${captionH}" fill="${escapeXml(style.brandColor)}"/>`
    );
    const textBlockH = captionLines.length * CAPTION_LINE_H;
    const firstBaseline =
      barTop + (captionH - textBlockH) / 2 + CAPTION_FONT * 0.8;
    captionLines.forEach((ln, i) => {
      overlayParts.push(
        `<text x="${CAPTION_PAD_X}" y="${firstBaseline + i * CAPTION_LINE_H}"
          font-family="'Helvetica Neue', Arial, sans-serif" font-size="${CAPTION_FONT}"
          font-weight="500" fill="#f4f6fa">${escapeXml(ln)}</text>`
      );
    });
  }

  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}">${overlayParts.join("")}</svg>`;

  const png = await sharp({
    create: { width: FRAME_W, height: FRAME_H, channels: 4, background: BG },
  })
    .composite([
      { input: shot, left: sx, top: sy },
      { input: Buffer.from(overlay), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  return { png, target };
}

/**
 * The intro frame sequence for a point-style step: the cursor eases in from
 * `from` to `target`, then a ring pulses outward while the cursor gives a small
 * "click" dip. The final frame is the resting state (cursor on target, pulse
 * gone) — the compositor clones it for the hold. Composited over `base`.
 */
export async function renderIntroFrames(
  base: Buffer,
  opts: { from: Point; target: Point; style: VideoStyle }
): Promise<Buffer[]> {
  const { from, target, style } = opts;
  const r0 = 12 * SCALE;
  const r1 = 50 * SCALE;
  const frames: Buffer[] = [];
  for (let k = 0; k < INTRO_FRAMES; k++) {
    const p = Math.min(k / TRAVEL_FRAMES, 1);
    const eased = 1 - Math.pow(1 - p, 2); // ease-out into the target
    const x = Math.round(from.x + (target.x - from.x) * eased);
    const y = Math.round(from.y + (target.y - from.y) * eased);

    const parts: string[] = [];
    let bounce = 1;
    if (k >= TRAVEL_FRAMES) {
      const pp = Math.min((k - TRAVEL_FRAMES) / (PULSE_FRAMES - 1), 1);
      const er = 1 - Math.pow(1 - pp, 2);
      const radius = r0 + (r1 - r0) * er;
      const alpha = 0.5 * (1 - pp);
      if (alpha > 0.01) {
        parts.push(
          `<circle cx="${target.x}" cy="${target.y}" r="${radius.toFixed(1)}" fill="none"
            stroke="${escapeXml(style.brandColor)}" stroke-width="${(3 * SCALE).toFixed(1)}" stroke-opacity="${alpha.toFixed(3)}"/>`
        );
      }
      bounce = 1 - 0.16 * Math.sin(Math.PI * pp); // brief press-in
    }
    parts.push(pointerGlyph(style, x, y, SCALE * bounce));

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}">${parts.join("")}</svg>`;
    frames.push(
      await sharp(base)
        .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
        .png()
        .toBuffer()
    );
  }
  return frames;
}

const SLIDE_PAD_X = Math.round(150 * SCALE);
const SLIDE_TITLE_FONT = Math.round(52 * SCALE);
const SLIDE_TITLE_LH = Math.round(64 * SCALE);
const SLIDE_SUB_FONT = Math.round(24 * SCALE);
const SLIDE_SUB_LH = Math.round(36 * SCALE);

/** Resolve a slide's background to an SVG `<defs>`+fill, and a representative
 *  color (for text contrast). Handles theme, solid presets, and the 2-stop
 *  135° gradient presets; image backgrounds fall back to the theme color. */
function slideBackground(a: SlideAppearance): {
  defs: string;
  fill: string;
  rep: string;
} {
  const value = a.background.kind === "preset" ? a.background.value : null;
  if (value && value.startsWith("linear-gradient")) {
    const stops = value.match(/#[0-9a-fA-F]{3,6}/g) ?? [];
    const c1 = stops[0] ?? "#e9eefb";
    const c2 = stops[1] ?? c1;
    // Presets are 135deg (top-left → bottom-right).
    const defs = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${escapeXml(c1)}"/>
      <stop offset="1" stop-color="${escapeXml(c2)}"/></linearGradient></defs>`;
    return { defs, fill: "url(#bg)", rep: c1 };
  }
  if (value && /^#[0-9a-fA-F]{3,6}$/.test(value)) {
    return { defs: "", fill: escapeXml(value), rep: value };
  }
  const themed = a.theme === "dark" ? "#18181b" : "#ffffff";
  return { defs: "", fill: themed, rep: themed };
}

/**
 * A title slide (1920×1080 PNG): the intro/chapter's title + subtitle centered
 * (or aligned) over the slide's background, with a short brand accent rule. No
 * pointer, no chrome — a clean card, matching the Interactive slide.
 */
export async function renderSlideFrame(opts: {
  title: string;
  subtitle: string;
  appearance: SlideAppearance;
  style: VideoStyle;
}): Promise<Buffer> {
  const { title, subtitle, appearance, style } = opts;
  const { defs, fill, rep } = slideBackground(appearance);
  const dark = luminance(rep) < 0.5;
  const titleColor = dark ? "#ffffff" : "#18181b";
  const subColor = dark ? "#ffffffb3" : "#52525b";

  const maxTextW = FRAME_W - SLIDE_PAD_X * 2;
  const titleLines = wrapText(title, SLIDE_TITLE_FONT, maxTextW, 0.5, 4);
  const subLines = wrapText(subtitle, SLIDE_SUB_FONT, maxTextW, 0.52, 4);

  const align = appearance.align;
  const anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
  const ax =
    align === "left"
      ? SLIDE_PAD_X
      : align === "right"
        ? FRAME_W - SLIDE_PAD_X
        : FRAME_W / 2;

  const accentH = Math.round(4 * SCALE);
  const accentW = Math.round(56 * SCALE);
  const gapTitleSub = titleLines.length && subLines.length ? 28 * SCALE : 0;
  const accentGap = titleLines.length ? 34 * SCALE : 0;
  const blockH =
    accentH +
    accentGap +
    titleLines.length * SLIDE_TITLE_LH +
    gapTitleSub +
    subLines.length * SLIDE_SUB_LH;
  let y = Math.round((FRAME_H - blockH) / 2);

  const parts: string[] = [defs, `<rect width="${FRAME_W}" height="${FRAME_H}" fill="${fill}"/>`];

  // Brand accent rule (left edge of the text block, or centered).
  const accentX =
    align === "left" ? SLIDE_PAD_X : align === "right" ? FRAME_W - SLIDE_PAD_X - accentW : FRAME_W / 2 - accentW / 2;
  parts.push(
    `<rect x="${accentX}" y="${y}" width="${accentW}" height="${accentH}" rx="${accentH / 2}" fill="${escapeXml(style.brandColor)}"/>`
  );
  y += accentH + accentGap;

  y += SLIDE_TITLE_FONT * 0.8; // to first baseline
  titleLines.forEach((ln, i) => {
    parts.push(
      `<text x="${ax}" y="${y + i * SLIDE_TITLE_LH}" text-anchor="${anchor}"
        font-family="Georgia, 'Times New Roman', serif" font-size="${SLIDE_TITLE_FONT}"
        font-weight="600" fill="${titleColor}">${escapeXml(ln)}</text>`
    );
  });
  y += (titleLines.length - 1) * SLIDE_TITLE_LH + gapTitleSub;
  if (titleLines.length) y += SLIDE_TITLE_LH - SLIDE_TITLE_FONT * 0.8;

  y += SLIDE_SUB_FONT * 0.8;
  subLines.forEach((ln, i) => {
    parts.push(
      `<text x="${ax}" y="${y + i * SLIDE_SUB_LH}" text-anchor="${anchor}"
        font-family="'Helvetica Neue', Arial, sans-serif" font-size="${SLIDE_SUB_FONT}"
        font-weight="400" fill="${subColor}">${escapeXml(ln)}</text>`
    );
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}">${parts.join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
