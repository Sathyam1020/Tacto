import {
  resolveCustomization,
  type GuideCustomization,
} from "@workspace/contracts/guide"
import jsPDF from "jspdf"

import type { ClickRect } from "@/lib/guides"

/**
 * Client-side PDF export. Each step's screenshot is composited in a canvas
 * (blob URL → untainted canvas) with the guide's chosen hotspot in its brand
 * color, then laid out with jsPDF honoring brand color, logo, RTL, and an
 * optional zoom toward the click. The caller passes already-translated content
 * so the export matches the language on screen.
 *
 * Font note: the brand fonts are all sans, so the built-in Helvetica is a
 * faithful stand-in. Non-Latin scripts (e.g. Arabic) need an embedded font —
 * a known jsPDF limitation, deferred.
 */

type PdfBlock = {
  type: "STEP" | "HEADING" | "TIP" | "ALERT" | "OUTCOME"
  content: string
  screenshotUrl: string | null
  clickRect: ClickRect | null
}

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [94, 106, 210] // cobalt fallback
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function stripHtml(html: string): string {
  const el = document.createElement("div")
  el.innerHTML = html
  return (el.textContent ?? "").trim()
}

// Characters jsPDF's built-in (WinAnsi / CP1252) font can render beyond Latin-1
// — smart quotes, dashes, etc. Anything else (CJK, Devanagari, Arabic…) comes
// out as garbage, so those strings are rendered as canvas images instead.
const CP1252_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
])

function pdfFontRenderable(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c === 0x09 || c === 0x0a || c === 0x0d) continue
    if (c >= 0x20 && c <= 0xff) continue
    if (CP1252_EXTRA.has(c)) continue
    return false
  }
  return true
}

/** Word-wrap for canvas rendering, falling back to per-character breaks for
 *  space-less scripts (CJK). Measures with the given 2D context. */
function wrapCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number
): string[] {
  const lines: string[] = []
  let line = ""
  const addWord = (word: string) => {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxW) {
      line = candidate
      return
    }
    if (line) {
      lines.push(line)
      line = ""
    }
    if (ctx.measureText(word).width <= maxW) {
      line = word
      return
    }
    for (const ch of word) {
      if (line && ctx.measureText(line + ch).width > maxW) {
        lines.push(line)
        line = ""
      }
      line += ch
    }
  }
  for (const word of text.split(/\s+/).filter(Boolean)) addWord(word)
  if (line) lines.push(line)
  return lines.length ? lines : [""]
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  // Fetch through the same-origin proxy so the canvas is never tainted.
  const proxied = `/img-proxy?url=${encodeURIComponent(url)}`
  const blob = await (await fetch(proxied)).blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("image load failed"))
      img.src = objectUrl
    })
    return img
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
  }
}

function toPngDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext("2d")!.drawImage(img, 0, 0)
  return canvas.toDataURL("image/png")
}

/** Draw the chosen hotspot at the click, in the brand color. */
function drawHotspot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rectPx: { x: number; y: number; w: number; h: number },
  color: Rgb,
  hotspot: GuideCustomization["general"]["hotspot"]
): void {
  const [r, g, b] = color
  const solid = `rgb(${r},${g},${b})`
  const base =
    Math.max(ctx.canvas.width, ctx.canvas.height) * 0.011 * hotspot.size

  if (hotspot.type === "highlight-box") {
    const pad = base * 0.7
    const x = rectPx.x - pad
    const y = rectPx.y - pad
    const w = rectPx.w + pad * 2
    const h = rectPx.h + pad * 2
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, base)
    ctx.fillStyle = `rgba(${r},${g},${b},0.12)`
    ctx.fill()
    ctx.lineWidth = base * 0.45
    ctx.strokeStyle = solid
    ctx.stroke()
    return
  }
  if (hotspot.type === "cursor") {
    const s = base * 2.4
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx, cy + s)
    ctx.lineTo(cx + s * 0.3, cy + s * 0.72)
    ctx.lineTo(cx + s * 0.5, cy + s * 1.08)
    ctx.lineTo(cx + s * 0.68, cy + s * 1.0)
    ctx.lineTo(cx + s * 0.46, cy + s * 0.64)
    ctx.lineTo(cx + s * 0.74, cy + s * 0.6)
    ctx.closePath()
    ctx.fillStyle = solid
    ctx.fill()
    ctx.lineWidth = base * 0.22
    ctx.strokeStyle = "rgba(255,255,255,0.9)"
    ctx.stroke()
    return
  }
  if (hotspot.type === "glowing-circle") {
    ctx.beginPath()
    ctx.arc(cx, cy, base * 2.3, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${r},${g},${b},0.25)`
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, base * 1.15, 0, Math.PI * 2)
    ctx.fillStyle = solid
    ctx.fill()
    ctx.lineWidth = base * 0.35
    ctx.strokeStyle = "rgba(255,255,255,0.9)"
    ctx.stroke()
    return
  }
  // Default reticle: ring + crosshair ticks + a center dot with a white halo.
  const R = base * 1.7
  const tick = base
  ctx.strokeStyle = solid
  ctx.lineWidth = base * 0.32
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx, cy - R)
  ctx.lineTo(cx, cy - R - tick)
  ctx.moveTo(cx, cy + R)
  ctx.lineTo(cx, cy + R + tick)
  ctx.moveTo(cx - R, cy)
  ctx.lineTo(cx - R - tick, cy)
  ctx.moveTo(cx + R, cy)
  ctx.lineTo(cx + R + tick, cy)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, base * 0.75, 0, Math.PI * 2)
  ctx.fillStyle = solid
  ctx.fill()
  ctx.lineWidth = base * 0.3
  ctx.strokeStyle = "white"
  ctx.stroke()
}

/** Composite the screenshot + hotspot, with an optional zoom-crop toward the
 *  click, and return a JPEG data URL. */
function composite(
  img: HTMLImageElement,
  clickRect: ClickRect | null,
  color: Rgb,
  hotspot: GuideCustomization["general"]["hotspot"],
  zoom: number
): string {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  let sx = 0
  let sy = 0
  let sw = iw
  let sh = ih
  if (zoom > 1 && clickRect) {
    sw = iw / zoom
    sh = ih / zoom
    const cx = (clickRect.x + clickRect.w / 2) * iw
    const cy = (clickRect.y + clickRect.h / 2) * ih
    sx = clamp(cx - sw / 2, 0, iw - sw)
    sy = clamp(cy - sh / 2, 0, ih - sh)
  }

  const canvas = document.createElement("canvas")
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

  if (clickRect) {
    const cx = (clickRect.x + clickRect.w / 2) * iw - sx
    const cy = (clickRect.y + clickRect.h / 2) * ih - sy
    const rectPx = {
      x: clickRect.x * iw - sx,
      y: clickRect.y * ih - sy,
      w: clickRect.w * iw,
      h: clickRect.h * ih,
    }
    drawHotspot(ctx, cx, cy, rectPx, color, hotspot)
  }
  return canvas.toDataURL("image/jpeg", 0.85)
}

export async function downloadGuidePdf(guide: {
  title: string
  summary?: string | null
  blocks: PdfBlock[]
  customization?: GuideCustomization | null
}): Promise<void> {
  const cust = resolveCustomization(guide.customization ?? null)
  const color = hexToRgb(cust.brand.color)
  const rtl = cust.brand.rtl
  const zoom = cust.scrollView.initialZoom

  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 40
  const contentW = pageW - margin * 2
  const startX = rtl ? pageW - margin : margin
  const align = rtl ? "right" : "left"
  let y = margin

  function ensureSpace(height: number) {
    if (y + height > pageH - margin) {
      pdf.addPage()
      y = margin
    }
  }

  function write(
    text: string,
    size: number,
    weight: "normal" | "bold",
    rgb: Rgb
  ) {
    const lineH = size * 1.35
    // Latin scripts → native (selectable) PDF text.
    if (pdfFontRenderable(text)) {
      pdf.setFont("helvetica", weight)
      pdf.setFontSize(size)
      pdf.setTextColor(rgb[0], rgb[1], rgb[2])
      const lines = pdf.splitTextToSize(text, contentW) as string[]
      ensureSpace(lines.length * lineH + 4)
      pdf.text(lines, startX, y + size, { align, maxWidth: contentW })
      y += lines.length * lineH + 8
      return
    }
    // Non-Latin (CJK, Devanagari, Arabic…) → render with the browser's system
    // fonts to a canvas, then place it as an image (jsPDF's font can't).
    const SCALE = 3 // supersample for crisp text
    const font = `${weight === "bold" ? "bold " : ""}${Math.round(size * SCALE)}px system-ui, -apple-system, "Segoe UI", "Noto Sans", sans-serif`
    const maxW = contentW * SCALE
    const measure = document.createElement("canvas").getContext("2d")!
    measure.font = font
    const lines = wrapCanvas(measure, text, maxW)
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(maxW)
    canvas.height = Math.ceil(lines.length * lineH * SCALE)
    const ctx = canvas.getContext("2d")!
    ctx.font = font
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    ctx.textBaseline = "alphabetic"
    ctx.textAlign = rtl ? "right" : "left"
    const tx = rtl ? maxW : 0
    lines.forEach((ln, i) =>
      ctx.fillText(ln, tx, i * lineH * SCALE + size * SCALE)
    )
    const drawH = lines.length * lineH
    ensureSpace(drawH + 4)
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, y, contentW, drawH)
    y += drawH + 8
  }

  // Brand logo header.
  if (cust.brand.logoUrl) {
    try {
      const logo = await loadImage(cust.brand.logoUrl)
      const lh = 26
      const lw = (logo.naturalWidth / logo.naturalHeight) * lh
      pdf.addImage(
        toPngDataUrl(logo),
        "PNG",
        rtl ? pageW - margin - lw : margin,
        y,
        lw,
        lh
      )
      y += lh + 16
    } catch {
      /* skip an unloadable logo */
    }
  }

  // Title + brand-color rule.
  write(guide.title, 20, "bold", [24, 24, 27])
  pdf.setDrawColor(color[0], color[1], color[2])
  pdf.setLineWidth(2)
  pdf.line(margin, y - 2, rtl ? pageW - margin - contentW * 0.35 : margin + contentW * 0.35, y - 2)
  y += 8
  if (guide.summary) write(guide.summary, 12, "normal", [113, 113, 122])
  y += 6

  let stepNum = 0
  for (const block of guide.blocks) {
    const text = stripHtml(block.content)
    if (block.type === "STEP") {
      stepNum += 1
      write(`${stepNum}.  ${text}`, 12, "normal", [24, 24, 27])
    } else if (block.type === "HEADING") {
      write(text, 15, "bold", [24, 24, 27])
    } else {
      write(text, 12, "normal", [82, 82, 91])
    }

    if (
      (block.type === "STEP" || block.type === "OUTCOME") &&
      block.screenshotUrl
    ) {
      try {
        const img = await loadImage(block.screenshotUrl)
        const dataUrl = composite(
          img,
          block.clickRect,
          color,
          cust.general.hotspot,
          zoom
        )
        // The composite may be cropped by the zoom — use its aspect ratio.
        const cropAspect =
          zoom > 1 && block.clickRect
            ? img.naturalHeight / zoom / (img.naturalWidth / zoom)
            : img.naturalHeight / img.naturalWidth
        const drawH = cropAspect * contentW
        ensureSpace(drawH + 18)
        pdf.addImage(dataUrl, "JPEG", margin, y, contentW, drawH)
        y += drawH + 20
      } catch {
        /* skip an unloadable screenshot; keep the text */
      }
    }
  }

  const safe = guide.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")
  pdf.save(`${safe || "guide"}.pdf`)
}
