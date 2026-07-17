"use client"

import * as React from "react"
import { ArrowUpRight, Download, Droplet, Eraser, Square, Type, Undo2, Upload } from "lucide-react"

type Tool = "rect" | "arrow" | "text" | "blur"
type Ann =
  | { type: "rect"; x: number; y: number; w: number; h: number; color: string }
  | { type: "arrow"; x: number; y: number; w: number; h: number; color: string }
  | { type: "blur"; x: number; y: number; w: number; h: number }
  | { type: "text"; x: number; y: number; text: string; color: string }

const COLORS = ["#EF4444", "#5E6AD2", "#16A34A", "#EAB308", "#111827", "#FFFFFF"]
const TOOLS: { key: Tool; icon: typeof Square; label: string }[] = [
  { key: "rect", icon: Square, label: "Box" },
  { key: "arrow", icon: ArrowUpRight, label: "Arrow" },
  { key: "text", icon: Type, label: "Text" },
  { key: "blur", icon: Droplet, label: "Blur" },
]

export function ScreenshotAnnotatorTool() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const imgRef = React.useRef<HTMLImageElement | null>(null)
  const [tool, setTool] = React.useState<Tool>("rect")
  const [color, setColor] = React.useState(COLORS[0]!)
  const [anns, setAnns] = React.useState<Ann[]>([])
  const [hasImage, setHasImage] = React.useState(false)
  const draft = React.useRef<Ann | null>(null)
  const drawing = React.useRef(false)

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const all = draft.current ? [...anns, draft.current] : anns
    for (const a of all) paint(ctx, a, img, canvas.width, canvas.height)
  }, [anns])

  React.useEffect(() => {
    redraw()
  }, [redraw])

  const loadFile = (file: File) => {
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const maxW = 1600
      const scale = Math.min(1, maxW / img.naturalWidth)
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      imgRef.current = img
      setAnns([])
      setHasImage(true)
    }
    img.src = URL.createObjectURL(file)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
  }

  const pt = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    }
  }

  const onDown = (e: React.PointerEvent) => {
    if (!hasImage) return
    const { x, y } = pt(e)
    if (tool === "text") {
      const text = window.prompt("Text to add:")
      if (text) setAnns((a) => [...a, { type: "text", x, y, text, color }])
      return
    }
    drawing.current = true
    draft.current =
      tool === "blur" ? { type: "blur", x, y, w: 0, h: 0 } : { type: tool, x, y, w: 0, h: 0, color }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !draft.current) return
    const { x, y } = pt(e)
    // draft is only ever a region shape while dragging (text commits on down).
    const d = draft.current as Extract<Ann, { w: number }>
    draft.current = { ...d, w: x - d.x, h: y - d.y }
    redraw()
  }

  const onUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const d = draft.current
    draft.current = null
    if (d && (Math.abs((d as { w: number }).w) > 4 || Math.abs((d as { h: number }).h) > 4)) {
      setAnns((a) => [...a, d])
    } else {
      redraw()
    }
  }

  const undo = () => setAnns((a) => a.slice(0, -1))
  const clear = () => setAnns([])
  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = "tacto-annotated.png"
    a.click()
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--l-hairline)] bg-white p-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]">
          <Upload className="size-4" /> {hasImage ? "Replace" : "Upload image"}
          <input type="file" accept="image/*" onChange={onPick} className="hidden" />
        </label>

        <div className="flex items-center gap-1 rounded-xl border border-[var(--l-hairline)] bg-[var(--l-canvas)] p-1">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTool(t.key)}
              aria-pressed={tool === t.key}
              title={t.label}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                tool === t.key ? "bg-white text-cobalt shadow-sm" : "text-[var(--l-ink-subtle)] hover:text-[var(--l-ink)]"
              }`}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`size-6 rounded-full border transition-transform hover:scale-110 ${color === c ? "ring-2 ring-cobalt ring-offset-2" : "border-black/10"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={undo} disabled={!anns.length} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--l-hairline-strong)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--l-ink)] transition-colors hover:bg-[var(--l-hover)] disabled:opacity-40">
            <Undo2 className="size-3.5" /> Undo
          </button>
          <button type="button" onClick={clear} disabled={!anns.length} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--l-hairline-strong)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--l-ink)] transition-colors hover:bg-[var(--l-hover)] disabled:opacity-40">
            <Eraser className="size-3.5" /> Clear
          </button>
          <button type="button" onClick={download} disabled={!hasImage} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--l-ink)] px-3 py-1.5 text-[12.5px] font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-40">
            <Download className="size-3.5" /> PNG
          </button>
        </div>
      </div>

      {/* Canvas stage */}
      <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-3xl border border-[var(--l-hairline)] bg-[var(--l-canvas)] p-4">
        {hasImage ? (
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="max-h-[560px] max-w-full cursor-crosshair rounded-lg shadow-sm"
          />
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--l-hairline-strong)] px-10 py-16 text-center transition-colors hover:border-cobalt/50">
            <Upload className="size-7 text-[var(--l-ink-tertiary)]" />
            <span className="text-[14px] font-medium text-[var(--l-ink)]">Upload a screenshot to annotate</span>
            <span className="text-[12.5px] text-[var(--l-ink-tertiary)]">It stays in your browser — nothing is uploaded.</span>
            <input type="file" accept="image/*" onChange={onPick} className="hidden" />
          </label>
        )}
      </div>
    </div>
  )
}

function paint(ctx: CanvasRenderingContext2D, a: Ann, img: HTMLImageElement, cw: number, ch: number) {
  if (a.type === "blur") {
    const x = a.w < 0 ? a.x + a.w : a.x
    const y = a.h < 0 ? a.y + a.h : a.y
    const w = Math.abs(a.w)
    const h = Math.abs(a.h)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    ctx.filter = "blur(9px)"
    ctx.drawImage(img, 0, 0, cw, ch)
    ctx.restore()
    return
  }
  if (a.type === "text") {
    ctx.save()
    ctx.font = "600 24px Geist, system-ui, sans-serif"
    ctx.textBaseline = "top"
    ctx.lineWidth = 4
    ctx.strokeStyle = "rgba(0,0,0,0.35)"
    ctx.strokeText(a.text, a.x, a.y)
    ctx.fillStyle = a.color
    ctx.fillText(a.text, a.x, a.y)
    ctx.restore()
    return
  }
  ctx.save()
  ctx.strokeStyle = a.color
  ctx.lineWidth = 4
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  if (a.type === "rect") {
    ctx.strokeRect(a.x, a.y, a.w, a.h)
  } else {
    // arrow from (x,y) to (x+w, y+h)
    const x2 = a.x + a.w
    const y2 = a.y + a.h
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    const angle = Math.atan2(y2 - a.y, x2 - a.x)
    const head = 16
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6))
    ctx.stroke()
  }
  ctx.restore()
}
