"use client"

import * as React from "react"
import { Minus, Plus } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import type { ClickRect } from "@/lib/guides"

/**
 * A captured screenshot in a subtle browser frame, with an animated click
 * pointer at the target. `highlight` draws a soft focus ring around the target
 * (the walkthrough — no heavy dimming). `onAdvance` makes the pointer a
 * clickable hotspot. `chromeActions` renders controls in the chrome bar. With
 * `controls`, it gains zoom + drag-to-pan instead. Shared by list + walkthrough.
 */
export function ScreenshotFrame({
  src,
  clickRect,
  highlight = false,
  chrome = true,
  zoom: autoZoom,
  controls = false,
  onAdvance,
  chromeActions,
  className,
}: {
  src: string
  clickRect?: ClickRect | null
  /** Soft focus ring around the target (walkthrough). */
  highlight?: boolean
  chrome?: boolean
  /** Fixed zoom toward the pointer (walkthrough). Ignored when `controls`. */
  zoom?: number
  /** Show zoom controls + enable drag-to-pan. */
  controls?: boolean
  /** Clicking the pointer / target advances the walkthrough. */
  onAdvance?: () => void
  /** Controls rendered on the right of the chrome bar (walkthrough). */
  chromeActions?: React.ReactNode
  className?: string
}) {
  const cx = clickRect ? (clickRect.x + clickRect.w / 2) * 100 : null
  const cy = clickRect ? (clickRect.y + clickRect.h / 2) * 100 : null

  if (controls) {
    return (
      <ZoomableFrame
        src={src}
        cx={cx}
        cy={cy}
        chrome={chrome}
        className={className}
      />
    )
  }

  // Non-interactive: static, or fixed zoom toward the pointer (walkthrough).
  const zoomStyle: React.CSSProperties | undefined =
    autoZoom && autoZoom > 1 && cx !== null && cy !== null
      ? { transform: `scale(${autoZoom})`, transformOrigin: `${cx}% ${cy}%` }
      : undefined

  return (
    <div className={cn("bg-card overflow-hidden rounded-xl border", className)}>
      {chrome && <ChromeBar actions={chromeActions} />}
      <div className="relative overflow-hidden">
        <div style={zoomStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="block w-full" />
          {highlight && clickRect && <Highlight rect={clickRect} />}
          {/* Clickable hotspot over the target — advances the walkthrough. */}
          {onAdvance && clickRect && (
            <button
              aria-label="Next step"
              onClick={onAdvance}
              className="absolute cursor-pointer"
              style={{
                left: `${Math.max(0, (clickRect.x - 0.02) * 100)}%`,
                top: `${Math.max(0, (clickRect.y - 0.02) * 100)}%`,
                width: `${(clickRect.w + 0.04) * 100}%`,
                height: `${(clickRect.h + 0.04) * 100}%`,
              }}
            />
          )}
        </div>
        {cx !== null && cy !== null && (
          <Marker leftPct={cx} topPct={cy} counterScale={1} />
        )}
      </div>
    </div>
  )
}

/** Zoom + pan container. */
function ZoomableFrame({
  src,
  cx,
  cy,
  chrome,
  className,
}: {
  src: string
  cx: number | null
  cy: number | null
  chrome: boolean
  className?: string
}) {
  // Zoom + pan live in one state object so a single pure updater can move
  // both together (nesting setState was double-applying under StrictMode).
  const [view, setView] = React.useState({ zoom: 1, pan: { x: 0, y: 0 } })
  const { zoom, pan } = view
  // While dragging we drop the transform transition so panning tracks the
  // cursor 1:1; zoom-button changes animate.
  const [dragging, setDragging] = React.useState(false)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef<{
    startX: number
    startY: number
    panX: number
    panY: number
  } | null>(null)

  function clampPan(x: number, y: number, z: number) {
    const el = viewportRef.current
    if (!el) return { x, y }
    const w = el.clientWidth
    const h = el.clientHeight
    return {
      x: Math.min(0, Math.max(-(w * (z - 1)), x)),
      y: Math.min(0, Math.max(-(h * (z - 1)), y)),
    }
  }

  function stepZoom(delta: number) {
    const el = viewportRef.current
    setView((prev) => {
      const z = Math.min(
        3,
        Math.max(1, Math.round((prev.zoom + delta) * 100) / 100)
      )
      if (z === 1 || !el) return { zoom: z, pan: { x: 0, y: 0 } }
      // With a click pointer, zoom toward it: keep the pointer's on-screen
      // position fixed across the step (focal-point zoom). transform is
      // `translate(pan) scale(z)` from origin 0,0, so a content point at
      // (fx,fy) sits at screen `pan + f*z`; hold that constant.
      if (cx !== null && cy !== null) {
        const fx = (cx / 100) * el.clientWidth
        const fy = (cy / 100) * el.clientHeight
        return {
          zoom: z,
          pan: clampPan(
            prev.pan.x + fx * (prev.zoom - z),
            prev.pan.y + fy * (prev.zoom - z),
            z
          ),
        }
      }
      // No pointer: keep the existing corner-anchored behavior.
      return { zoom: z, pan: clampPan(prev.pan.x, prev.pan.y, z) }
    })
  }

  function onPointerDown(e: React.PointerEvent) {
    if (zoom <= 1) return
    drag.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.startX
    const dy = e.clientY - drag.current.startY
    const d = drag.current
    setView((prev) => ({
      ...prev,
      pan: clampPan(d.panX + dx, d.panY + dy, prev.zoom),
    }))
  }
  function endDrag() {
    drag.current = null
    setDragging(false)
  }

  return (
    <div
      // The screenshot is self-contained: its clicks/drags never bubble to a
      // wrapping "tap to edit" region (editor preview) — only the text opens
      // the editor. select-none stops stray text highlighting while panning.
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "bg-card cursor-default overflow-hidden rounded-xl border select-none",
        className
      )}
    >
      {chrome && <ChromeBar />}
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className={cn(
          "relative overflow-hidden",
          zoom > 1 && "cursor-grab active:cursor-grabbing"
        )}
      >
        <div
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: "0 0",
            transition: dragging
              ? "none"
              : "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none block w-full select-none"
          />
          {cx !== null && cy !== null && (
            <Marker leftPct={cx} topPct={cy} counterScale={1 / zoom} />
          )}
        </div>

        {/* Zoom controls — frosted "liquid glass" pill. stopPropagation so a
            press here never starts a pan-drag (whose pointer capture would
            otherwise swallow the button click). */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          // Don't let a press start a text selection, and don't let the click
          // bubble to a wrapping "tap to edit" region (the editor preview).
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-3 bottom-3 z-10 flex flex-col items-center overflow-hidden rounded-full border border-white/20 bg-black/25 text-white shadow-[0_8px_28px_-6px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.45),inset_0_-1px_1px_0_rgba(0,0,0,0.25)] backdrop-blur-xl backdrop-saturate-150"
        >
          <button
            onClick={() => stepZoom(0.5)}
            aria-label="Zoom in"
            className="flex size-8 items-center justify-center transition-[background-color,transform] hover:bg-white/20 active:scale-90"
          >
            <Plus className="size-4 drop-shadow-sm" />
          </button>
          <span className="px-1 py-0.5 font-mono text-[10px] text-white/80 tabular-nums drop-shadow-sm">
            {zoom.toFixed(1)}×
          </span>
          <button
            onClick={() => stepZoom(-0.5)}
            aria-label="Zoom out"
            className="flex size-8 items-center justify-center transition-[background-color,transform] hover:bg-white/20 active:scale-90"
          >
            <Minus className="size-4 drop-shadow-sm" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ChromeBar({ actions }: { actions?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-b px-3 py-2.5">
      <span className="bg-line-2 size-2 rounded-full" />
      <span className="bg-line-2 size-2 rounded-full" />
      <span className="bg-line-2 size-2 rounded-full" />
      <span className="bg-sheet ml-2 h-4 flex-1 rounded-full border" />
      {actions && <div className="flex items-center gap-0.5 pl-1">{actions}</div>}
    </div>
  )
}

/**
 * A soft focus ring around the click target — the walkthrough's "look here"
 * without dimming the rest of the screen (Guidejar-style, not a dark spotlight).
 */
function Highlight({ rect }: { rect: ClickRect }) {
  const pad = 0.012
  return (
    <div
      className="pointer-events-none absolute rounded-md"
      style={{
        left: `${Math.max(0, (rect.x - pad) * 100)}%`,
        top: `${Math.max(0, (rect.y - pad) * 100)}%`,
        width: `${(rect.w + pad * 2) * 100}%`,
        height: `${(rect.h + pad * 2) * 100}%`,
        boxShadow:
          "0 0 0 2px var(--primary), 0 0 0 6px color-mix(in srgb, var(--primary) 18%, transparent)",
      }}
    />
  )
}

/**
 * The Datum reticle — the signature click mark: a surveyor's crosshair
 * (ticks + ring + core) with a radar ping. It marks the exact point of the
 * interaction on every screenshot.
 */
function Marker({
  leftPct,
  topPct,
  counterScale,
}: {
  leftPct: number
  topPct: number
  counterScale: number
}) {
  return (
    <span
      className="text-primary pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      <span className="block" style={{ transform: `scale(${counterScale})` }}>
        <span className="relative flex size-5 items-center justify-center">
          {/* radar ping */}
          <span className="animate-click-ripple absolute inset-1 rounded-full border border-current motion-reduce:hidden" />
          {/* crosshair ticks */}
          <span className="absolute top-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-current" />
          <span className="absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-current" />
          <span className="absolute top-1/2 left-0 h-px w-1.5 -translate-y-1/2 bg-current" />
          <span className="absolute top-1/2 right-0 h-px w-1.5 -translate-y-1/2 bg-current" />
          {/* fixed ring */}
          <span className="absolute inset-1 rounded-full border border-current" />
          {/* core */}
          <span className="animate-click-core size-1.5 rounded-full bg-current shadow-[0_0_0_2px_white] motion-reduce:animate-none" />
        </span>
      </span>
    </span>
  )
}
