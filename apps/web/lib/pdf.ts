import jsPDF from "jspdf"

import type { ClickRect } from "@/lib/guides"

/**
 * Client-side PDF export. For each step we composite the click pointer onto
 * the screenshot in a canvas (blob URL → untainted canvas), then lay out
 * numbered instructions + images with jsPDF. Works in the app and the
 * logged-out public view.
 */

type PdfBlock = {
  type: "STEP" | "HEADING" | "TIP" | "ALERT"
  content: string
  screenshotUrl: string | null
  clickRect: ClickRect | null
}

function stripHtml(html: string): string {
  const el = document.createElement("div")
  el.innerHTML = html
  return (el.textContent ?? "").trim()
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  // Fetch through our same-origin proxy so the canvas is never tainted and
  // no R2 CORS config is required.
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
    // Revoked after the caller draws it.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
  }
}

/** Draw the screenshot + pointer ring to a canvas and return a JPEG dataURL. */
function composite(img: HTMLImageElement, clickRect: ClickRect | null): string {
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0)

  if (clickRect) {
    const cx = (clickRect.x + clickRect.w / 2) * canvas.width
    const cy = (clickRect.y + clickRect.h / 2) * canvas.height
    const r = Math.max(canvas.width, canvas.height) * 0.011
    ctx.beginPath()
    ctx.arc(cx, cy, r * 2, 0, Math.PI * 2)
    ctx.lineWidth = r * 0.7
    ctx.strokeStyle = "#0E7C5B"
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2)
    ctx.fillStyle = "#0E7C5B"
    ctx.fill()
  }
  return canvas.toDataURL("image/jpeg", 0.85)
}

export async function downloadGuidePdf(guide: {
  title: string
  blocks: PdfBlock[]
}): Promise<void> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 40
  const contentW = pageW - margin * 2
  let y = margin

  function ensureSpace(height: number) {
    if (y + height > pageH - margin) {
      pdf.addPage()
      y = margin
    }
  }

  // Title
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(20)
  const titleLines = pdf.splitTextToSize(guide.title, contentW)
  pdf.text(titleLines, margin, y + 16)
  y += titleLines.length * 24 + 20

  let stepNum = 0
  for (const block of guide.blocks) {
    if (block.type === "STEP") stepNum += 1
    const text = stripHtml(block.content)
    const label = block.type === "STEP" ? `${stepNum}. ${text}` : text

    pdf.setFont("helvetica", block.type === "HEADING" ? "bold" : "normal")
    pdf.setFontSize(block.type === "HEADING" ? 15 : 12)
    const lines = pdf.splitTextToSize(label, contentW)
    ensureSpace(lines.length * 16 + 6)
    pdf.text(lines, margin, y + 12)
    y += lines.length * 16 + 10

    if (block.type === "STEP" && block.screenshotUrl) {
      try {
        const img = await loadImage(block.screenshotUrl)
        const drawH = (img.naturalHeight / img.naturalWidth) * contentW
        const dataUrl = composite(img, block.clickRect)
        ensureSpace(drawH + 18)
        pdf.addImage(dataUrl, "JPEG", margin, y, contentW, drawH)
        y += drawH + 22
      } catch {
        // Skip an unloadable screenshot; keep the text.
      }
    }
  }

  const safe = guide.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")
  pdf.save(`${safe || "guide"}.pdf`)
}
