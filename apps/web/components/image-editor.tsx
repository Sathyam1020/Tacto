"use client"

import * as React from "react"
import {
  ArrowUpRight,
  Circle,
  Crop,
  Droplet,
  Loader2,
  MousePointer2,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react"

import { createPortal } from "react-dom"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

/* fabric is heavy + browser-only → dynamically imported on open. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fabric = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricCanvas = any

type Tool = "select" | "rect" | "ellipse" | "arrow" | "text" | "blur" | "crop"

const MAX_W = 860
const MAX_H = 560
const PALETTE = ["#5e6ad2", "#e5484d", "#f5a623", "#30a46c", "#111111", "#ffffff"]

/** A canvas-safe, same-origin URL for a screenshot. `blob:`/`data:` are already
 *  local; http(s) (R2) is loaded through the same-origin proxy so the canvas is
 *  never tainted and can export. Loading the proxy URL straight into an <img>
 *  (no fetch/blob) is the most reliable path. */
function proxiedSrc(src: string): string {
  if (src.startsWith("blob:") || src.startsWith("data:")) return src
  return `/img-proxy?url=${encodeURIComponent(src)}`
}

function loadImg(url: string, cross: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image()
    if (cross) i.crossOrigin = "anonymous"
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error("load failed"))
    i.src = url
  })
}

/** Load a screenshot robustly for the canvas: prefer the same-origin proxy
 *  (untainted export); fall back to a direct cross-origin load, then a plain
 *  direct load (display-only) so a flaky proxy never leaves a blank editor. */
async function loadScreenshot(src: string): Promise<HTMLImageElement | null> {
  if (src.startsWith("blob:") || src.startsWith("data:")) {
    try {
      return await loadImg(src, false)
    } catch {
      return null
    }
  }
  const attempts: [string, boolean][] = [
    [`/img-proxy?url=${encodeURIComponent(src)}`, false],
    [src, true],
    [src, false],
  ]
  for (const [url, cross] of attempts) {
    try {
      return await loadImg(url, cross)
    } catch {
      /* try next */
    }
  }
  return null
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",")
  const mime = /:(.*?);/.exec(head!)?.[1] ?? "image/png"
  const bin = atob(body!)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/**
 * Global screenshot editor — a fabric.js canvas with annotate / blur / crop
 * tools. On save it flattens to a PNG blob; the caller uploads it as a new R2
 * key and swaps the shared Asset so the edit lands in both List + Interactive.
 */
export function ImageEditor({
  open,
  src,
  onClose,
  onSave,
}: {
  open: boolean
  src: string | null
  onClose: () => void
  onSave: (blob: Blob) => Promise<void> | void
}) {
  const canvasEl = React.useRef<HTMLCanvasElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const fabricRef = React.useRef<Fabric>(null)
  const canvasRef = React.useRef<FabricCanvas>(null)
  const bgUrlRef = React.useRef<string | null>(null)
  const scaleRef = React.useRef(1)
  const undoStack = React.useRef<string[]>([])
  const redoStack = React.useRef<string[]>([])
  const suppressSnapshot = React.useRef(false)

  const [tool, setTool] = React.useState<Tool>("select")
  const [color, setColor] = React.useState(PALETTE[0]!)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [canUndo, setCanUndo] = React.useState(false)
  const [canRedo, setCanRedo] = React.useState(false)

  const toolRef = React.useRef(tool)
  const colorRef = React.useRef(color)
  toolRef.current = tool
  colorRef.current = color

  const snapshot = React.useCallback(() => {
    const c = canvasRef.current
    if (!c || suppressSnapshot.current) return
    undoStack.current.push(JSON.stringify(c.toJSON()))
    if (undoStack.current.length > 40) undoStack.current.shift()
    redoStack.current = []
    setCanUndo(undoStack.current.length > 1)
    setCanRedo(false)
  }, [])

  // ── Init fabric on open ────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open || !src) return
    let disposed = false
    setLoading(true)
    setTool("select")
    undoStack.current = []
    redoStack.current = []

    // The <canvas> mounts inside a portaled dialog — wait for it rather than
    // bailing (which would leave the spinner forever).
    const waitForCanvas = () =>
      new Promise<HTMLCanvasElement>((resolve, reject) => {
        let tries = 0
        const tick = () => {
          if (disposed) return reject(new Error("disposed"))
          if (canvasEl.current) return resolve(canvasEl.current)
          if (tries++ > 60) return reject(new Error("canvas never mounted"))
          requestAnimationFrame(tick)
        }
        tick()
      })

    ;(async () => {
      try {
        const el = await waitForCanvas()
        const fabric = await import("fabric")
        if (disposed) return
        fabricRef.current = fabric

        // Load the screenshot (proxy → direct fallbacks). The canvas is created
        // regardless so tools always work, image or not.
        bgUrlRef.current = proxiedSrc(src)
        const dom = await loadScreenshot(src)
        if (!dom) {
          // eslint-disable-next-line no-console
          console.error("[image-editor] screenshot failed to load", src)
        }
        if (disposed) return

        const nW = dom?.naturalWidth || MAX_W
        const nH = dom?.naturalHeight || Math.round(MAX_W * 0.6)
        const scale = Math.min(MAX_W / nW, MAX_H / nH, 1)
        scaleRef.current = scale
        const w = Math.round(nW * scale)
        const h = Math.round(nH * scale)

        const canvas = new fabric.Canvas(el, {
          width: w,
          height: h,
          backgroundColor: "#f4f4f5",
          preserveObjectStacking: true,
        })
        canvasRef.current = canvas
        if (dom) {
          const img = new fabric.FabricImage(dom, {
            left: 0,
            top: 0,
            scaleX: scale,
            scaleY: scale,
            selectable: false,
            evented: false,
          })
          canvas.backgroundImage = img
        }
        canvas.calcOffset()
        canvas.requestRenderAll()

        canvas.on("object:added", snapshot)
        canvas.on("object:modified", snapshot)
        canvas.on("object:removed", snapshot)
        wireDrawing(canvas, fabric)

        undoStack.current = [JSON.stringify(canvas.toJSON())]
        setCanUndo(false)
        setLoading(false)
      } catch (err) {
        if (!disposed) {
          // eslint-disable-next-line no-console
          console.error("[image-editor] failed to load image", err)
          setLoading(false)
        }
      }
    })()

    return () => {
      disposed = true
      canvasRef.current?.dispose()
      canvasRef.current = null
      // NOTE: never revoke bgUrlRef here — for edited steps it's the step's own
      // persistent blob: screenshotUrl; revoking it blanks the image everywhere.
      bgUrlRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, src])

  // ── Tool mode: toggle selection / target-finding / cursor per tool ─────
  // With a drawing tool active we must skip fabric's own object selection so a
  // drag draws a new shape instead of grabbing an existing one.
  React.useEffect(() => {
    const c = canvasRef.current
    if (!c || loading) return
    const drawing = tool !== "select"
    c.selection = !drawing
    c.skipTargetFind = drawing
    c.defaultCursor = drawing ? "crosshair" : "default"
    c.hoverCursor = drawing ? "crosshair" : "move"
    c.forEachObject((o: { selectable: boolean; evented: boolean }) => {
      o.selectable = !drawing
      o.evented = !drawing
    })
    c.discardActiveObject()
    c.requestRenderAll()
  }, [tool, loading])

  // ── Drawing state machine ──────────────────────────────────────────────
  function wireDrawing(canvas: FabricCanvas, fabric: Fabric) {
    // Drive drawing from native pointer events captured on our own container —
    // fabric's own event pipeline wasn't firing inside the animated dialog.
    // Capture phase means we run before fabric regardless.
    const el = stageRef.current
    if (!el) return
    let drawing = false
    let start = { x: 0, y: 0 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let preview: any = null
    // Select-tool dragging (fabric's own move handling doesn't fire here, so we
    // move the active object ourselves).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dragObj: any = null
    let dragOff = { x: 0, y: 0 }
    let lastClick = { at: 0, obj: null as unknown }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hitTest = (p: { x: number; y: number }): any => {
      const objs = canvas.getObjects()
      for (let i = objs.length - 1; i >= 0; i--) {
        const b = objs[i].getBoundingRect()
        if (
          p.x >= b.left &&
          p.x <= b.left + b.width &&
          p.y >= b.top &&
          p.y <= b.top + b.height
        )
          return objs[i]
      }
      return null
    }

    // Client point → fabric scene coords, relative to the visible canvas
    // element (handles retina + any CSS scaling); null when outside the canvas.
    const toScene = (e: PointerEvent) => {
      const cel = canvasEl.current
      if (!cel) return null
      const r = cel.getBoundingClientRect()
      const zoom = canvas.getZoom?.() || 1
      return {
        x: ((e.clientX - r.left) * (canvas.getWidth() / (r.width || 1))) / zoom,
        y: ((e.clientY - r.top) * (canvas.getHeight() / (r.height || 1))) / zoom,
      }
    }

    const onMove = (e: PointerEvent) => {
      if (dragObj) {
        const q = toScene(e)
        if (!q) return
        dragObj.set({ left: q.x - dragOff.x, top: q.y - dragOff.y })
        dragObj.setCoords?.()
        canvas.requestRenderAll()
        return
      }
      if (!drawing || !preview) return
      const p = toScene(e)
      if (!p) return
      const t = toolRef.current
      if (t === "ellipse") {
        preview.set({
          left: Math.min(start.x, p.x),
          top: Math.min(start.y, p.y),
          rx: Math.abs(p.x - start.x) / 2,
          ry: Math.abs(p.y - start.y) / 2,
        })
      } else if (t === "arrow") {
        preview.set({ x2: p.x, y2: p.y })
      } else {
        preview.set({
          left: Math.min(start.x, p.x),
          top: Math.min(start.y, p.y),
          width: Math.abs(p.x - start.x),
          height: Math.abs(p.y - start.y),
        })
      }
      preview.setCoords?.()
      canvas.requestRenderAll()
    }

    const onUp = async (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      if (dragObj) {
        dragObj = null
        snapshot()
        return
      }
      if (!drawing) return
      drawing = false
      const t = toolRef.current
      const p = toScene(e) ?? start
      const prev = preview
      preview = null
      if (!prev) return
      const tiny = Math.abs(p.x - start.x) < 4 && Math.abs(p.y - start.y) < 4

      if (t === "arrow") {
        canvas.remove(prev)
        if (!tiny) canvas.add(makeArrow(fabric, start.x, start.y, p.x, p.y, colorRef.current))
      } else if (t === "crop") {
        canvas.remove(prev)
        if (!tiny) await cropTo(prev)
        setTool("select")
      } else if (t === "blur") {
        canvas.remove(prev)
        if (!tiny) await addBlur(prev)
      } else {
        if (tiny) canvas.remove(prev)
        else prev.set({ selectable: true, evented: true, hasControls: false })
      }
      if (t !== "blur" && t !== "crop") snapshot()
      canvas.requestRenderAll()
    }

    const onDown = (e: PointerEvent) => {
      const t = toolRef.current
      const p = toScene(e)
      if (!p) return

      if (t === "select") {
        const hit = hitTest(p)
        if (hit) {
          canvas.setActiveObject(hit)
          // Double-click a text box → edit it.
          const now = Date.now()
          if (
            hit === lastClick.obj &&
            now - lastClick.at < 350 &&
            typeof hit.enterEditing === "function"
          ) {
            hit.enterEditing()
            hit.selectAll?.()
          } else {
            dragObj = hit
            dragOff = { x: p.x - hit.left, y: p.y - hit.top }
          }
          lastClick = { at: now, obj: hit }
        } else {
          canvas.discardActiveObject()
          lastClick = { at: 0, obj: null }
        }
        canvas.requestRenderAll()
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        return
      }

      e.preventDefault()
      start = { x: p.x, y: p.y }
      const stroke = colorRef.current

      if (t === "text") {
        const tb = new fabric.Textbox("Text", {
          left: p.x,
          top: p.y,
          fontSize: 24,
          fill: stroke,
          fontFamily: "Inter, sans-serif",
          hasControls: false,
        })
        suppressSnapshot.current = true
        canvas.add(tb)
        suppressSnapshot.current = false
        canvas.setActiveObject(tb)
        tb.enterEditing()
        tb.selectAll?.()
        snapshot()
        setTool("select")
        return
      }

      drawing = true
      const base = { selectable: false, evented: false }
      if (t === "rect" || t === "crop" || t === "blur") {
        preview = new fabric.Rect({
          left: p.x,
          top: p.y,
          width: 1,
          height: 1,
          fill: t === "rect" ? "transparent" : "rgba(94,106,210,0.15)",
          stroke: t === "rect" ? stroke : "#5e6ad2",
          strokeWidth: t === "rect" ? 3 : 1,
          strokeDashArray: t === "rect" ? undefined : [6, 4],
          ...base,
        })
      } else if (t === "ellipse") {
        preview = new fabric.Ellipse({
          left: p.x,
          top: p.y,
          rx: 1,
          ry: 1,
          fill: "transparent",
          stroke,
          strokeWidth: 3,
          ...base,
        })
      } else if (t === "arrow") {
        preview = new fabric.Line([p.x, p.y, p.x, p.y], {
          stroke,
          strokeWidth: 4,
          ...base,
        })
      }
      if (preview) {
        suppressSnapshot.current = true
        canvas.add(preview)
        suppressSnapshot.current = false
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    }

    // Capture phase → runs before fabric's own listeners.
    el.addEventListener("pointerdown", onDown, true)

    // ── Blur: overlay a pixelated crop of the background over the region ──
    async function addBlur(rect: {
      left: number
      top: number
      width: number
      height: number
    }) {
      const s = scaleRef.current
      const url = bgUrlRef.current!
      const clip = await fabricRef.current.FabricImage.fromURL(url)
      clip.set({
        left: rect.left,
        top: rect.top,
        scaleX: s,
        scaleY: s,
        cropX: rect.left / s,
        cropY: rect.top / s,
        width: rect.width / s,
        height: rect.height / s,
        hasControls: false,
      })
      clip.filters = [
        new fabricRef.current.filters.Pixelate({
          blocksize: Math.max(6, Math.round(rect.width / s / 16)),
        }),
      ]
      clip.applyFilters()
      canvas.add(clip)
      snapshot()
    }

    // ── Crop: export the region and reload it as the new image ───────────
    async function cropTo(rect: {
      left: number
      top: number
      width: number
      height: number
    }) {
      const s = scaleRef.current
      // Export the crop at NATIVE resolution (multiplier undoes the display
      // scale) so cropping never degrades quality.
      const dataUrl = canvas.toDataURL({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        format: "png",
        multiplier: 1 / s,
      })
      const dom = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = dataUrl
      })
      const nW = dom.naturalWidth
      const nH = dom.naturalHeight
      const scale2 = Math.min(MAX_W / nW, MAX_H / nH, 1)
      canvas.clear()
      canvas.setDimensions({
        width: Math.round(nW * scale2),
        height: Math.round(nH * scale2),
      })
      const newImg = new fabricRef.current.FabricImage(dom, {
        left: 0,
        top: 0,
        scaleX: scale2,
        scaleY: scale2,
        selectable: false,
        evented: false,
      })
      canvas.backgroundImage = newImg
      scaleRef.current = scale2
      bgUrlRef.current = dataUrl // same-origin; future blurs sample it
      canvas.requestRenderAll()
      snapshot()
    }
  }

  function makeArrow(
    fabric: Fabric,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stroke: string
  ) {
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const head = 16
    const line = new fabric.Line([x1, y1, x2, y2], { stroke, strokeWidth: 4 })
    const tri = new fabric.Triangle({
      left: x2,
      top: y2,
      width: head,
      height: head,
      fill: stroke,
      originX: "center",
      originY: "center",
      angle: (angle * 180) / Math.PI + 90,
    })
    return new fabric.Group([line, tri], { hasControls: false })
  }

  // ── Actions ────────────────────────────────────────────────────────────
  const restore = React.useCallback((json: string) => {
    const c = canvasRef.current
    if (!c) return
    suppressSnapshot.current = true
    c.loadFromJSON(JSON.parse(json)).then(() => {
      suppressSnapshot.current = false
      c.requestRenderAll()
    })
  }, [])

  const undo = React.useCallback(() => {
    if (undoStack.current.length <= 1) return
    const cur = undoStack.current.pop()!
    redoStack.current.push(cur)
    restore(undoStack.current[undoStack.current.length - 1]!)
    setCanUndo(undoStack.current.length > 1)
    setCanRedo(true)
  }, [restore])

  const redo = React.useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(next)
    restore(next)
    setCanUndo(undoStack.current.length > 1)
    setCanRedo(redoStack.current.length > 0)
  }, [restore])

  const deleteSelected = React.useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    c.getActiveObjects().forEach((o: unknown) => c.remove(o))
    c.discardActiveObject()
    c.requestRenderAll()
  }, [])

  // Keyboard: delete selection.
  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      const c = canvasRef.current
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const active = c?.getActiveObject() as any
      if ((e.key === "Delete" || e.key === "Backspace") && active && !active.isEditing) {
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, deleteSelected])

  const save = React.useCallback(async () => {
    const c = canvasRef.current
    if (!c) return
    setSaving(true)
    try {
      c.discardActiveObject()
      c.requestRenderAll()
      const dataUrl = c.toDataURL({ format: "png", multiplier: 1 / scaleRef.current })
      await onSave(dataUrlToBlob(dataUrl))
      onClose()
    } finally {
      setSaving(false)
    }
  }, [onSave, onClose])

  const TOOLS: { id: Tool; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "ellipse", icon: Circle, label: "Circle" },
    { id: "arrow", icon: ArrowUpRight, label: "Arrow" },
    { id: "text", icon: Type, label: "Text" },
    { id: "blur", icon: Droplet, label: "Blur" },
    { id: "crop", icon: Crop, label: "Crop" },
  ]

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !saving && onClose()}
      />
      {/* Panel — a plain overlay (no focus trap) so fabric's canvas + text
          editing work natively. */}
      <div className="bg-card relative z-10 flex max-h-[92vh] w-full max-w-[960px] flex-col gap-4 overflow-auto rounded-xl border p-5 shadow-2xl">
        <h2 className="text-lg font-semibold tracking-tight">Edit image</h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-muted flex items-center gap-0.5 rounded-lg p-1">
            {TOOLS.map((t) => (
              <Tip key={t.id} label={t.label}>
                <button
                  type="button"
                  aria-label={t.label}
                  onClick={() => setTool(t.id)}
                  className={cn(
                    "grid size-9 place-items-center rounded-md transition-colors",
                    tool === t.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <t.icon className="size-4" />
                </button>
              </Tip>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {PALETTE.map((c) => (
              <Tip key={c} label={c}>
                <button
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "size-6 rounded-full border transition-transform",
                    color === c
                      ? "ring-foreground/40 scale-110 ring-2"
                      : "hover:scale-105"
                  )}
                />
              </Tip>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <IconBtn label="Undo" onClick={undo} disabled={!canUndo}>
              <Undo2 className="size-4" />
            </IconBtn>
            <IconBtn label="Redo" onClick={redo} disabled={!canRedo}>
              <Redo2 className="size-4" />
            </IconBtn>
            <IconBtn label="Delete selection" onClick={deleteSelected}>
              <Trash2 className="size-4" />
            </IconBtn>
          </div>
        </div>

        <div
          ref={stageRef}
          className="bg-muted/40 relative grid min-h-[320px] place-items-center overflow-auto rounded-lg border p-3"
        >
          {loading && (
            <div className="text-muted-foreground absolute inset-0 grid place-items-center">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
          <canvas ref={canvasEl} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Saving…" : "Save image"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** A lightweight hover tooltip rendered inline (inside the editor panel's own
 *  stacking context) so it always shows above the canvas. */
function Tip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span className="bg-foreground text-background pointer-events-none absolute top-full left-1/2 z-50 mt-1.5 -translate-x-1/2 rounded-md px-2 py-1 text-[11px] font-medium whitespace-nowrap opacity-0 shadow-md transition-opacity duration-100 group-hover/tip:opacity-100">
        {label}
      </span>
    </span>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className="text-muted-foreground hover:text-foreground hover:bg-muted grid size-9 place-items-center rounded-md transition-colors disabled:opacity-30"
      >
        {children}
      </button>
    </Tip>
  )
}
