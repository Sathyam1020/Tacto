"use client"

import * as React from "react"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { RichText } from "@/components/rich-text"
import { ScreenshotFrame } from "@/components/screenshot-frame"
import type { GuideBlock } from "@/lib/guides"

/**
 * Interactive walkthrough — one STEP at a time: the screenshot with the target
 * focus-ringed, a pointer on the click, and a Guidejar-style callout anchored
 * beside it. Click the pointer, the callout arrows, the bottom nav, or the
 * arrow keys to advance. Restart + full-screen live in the browser chrome.
 * (Headings/tips/alerts are a list-view concept and don't appear here.)
 */
export function InteractiveView({ blocks }: { blocks: GuideBlock[] }) {
  const slides = React.useMemo(
    () => blocks.filter((b) => b.type === "STEP"),
    [blocks]
  )
  const [index, setIndex] = React.useState(0)
  const [dir, setDir] = React.useState(1)
  const [fullscreen, setFullscreen] = React.useState(false)
  const reduce = useReducedMotion()
  const rootRef = React.useRef<HTMLDivElement>(null)

  const go = React.useCallback(
    (delta: number) => {
      setDir(delta > 0 ? 1 : -1)
      setIndex((i) => Math.min(Math.max(i + delta, 0), slides.length - 1))
    },
    [slides.length]
  )

  const restart = React.useCallback(() => {
    setDir(-1)
    setIndex(0)
  }, [])

  const toggleFullscreen = React.useCallback(() => {
    if (typeof document === "undefined") return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void rootRef.current?.requestFullscreen().catch(() => {})
  }, [])

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1)
      if (e.key === "ArrowLeft") go(-1)
    }
    function onFsChange() {
      setFullscreen(!!document.fullscreenElement)
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("fullscreenchange", onFsChange)
    }
  }, [go])

  if (slides.length === 0) {
    return (
      <p className="text-muted-foreground py-24 text-center font-serif text-lg">
        This guide has no steps to walk through yet.
      </p>
    )
  }

  const slide = slides[index]!
  const atStart = index === 0
  const atEnd = index === slides.length - 1
  const hasShot = !!slide.screenshotUrl
  const rect = hasShot ? slide.clickRect : null

  // Float the callout beside the pointer, on the roomier side, clamped in.
  const cx = rect ? (rect.x + rect.w / 2) * 100 : 50
  const cy = rect ? (rect.y + rect.h / 2) * 100 : 50
  const onRight = cx <= 55
  const clamp = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, n))
  const calloutStyle: React.CSSProperties = {
    top: `${clamp(cy, 18, 82)}%`,
    transform: "translateY(-50%)",
    ...(onRight
      ? { left: `calc(${clamp(cx, 2, 55)}% + 30px)` }
      : { right: `calc(${clamp(100 - cx, 2, 55)}% + 30px)` }),
  }

  const chromeActions = (
    <>
      <ChromeButton label="Restart" onClick={restart}>
        <RotateCcw className="size-3.5" />
      </ChromeButton>
      <ChromeButton
        label={fullscreen ? "Exit full screen" : "Full screen"}
        onClick={toggleFullscreen}
      >
        {fullscreen ? (
          <Minimize2 className="size-3.5" />
        ) : (
          <Maximize2 className="size-3.5" />
        )}
      </ChromeButton>
    </>
  )

  const callout = (
    <Callout
      style={calloutStyle}
      onRight={onRight}
      html={slide.content}
      index={index}
      total={slides.length}
      atStart={atStart}
      atEnd={atEnd}
      onPrev={() => go(-1)}
      onNext={() => go(1)}
    />
  )

  return (
    <div
      ref={rootRef}
      className={cn(
        "mx-auto max-w-4xl",
        fullscreen &&
          "bg-background flex h-full max-w-none items-center justify-center px-6"
      )}
    >
      <div className={cn("w-full", fullscreen && "max-w-6xl")}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <m.div
            key={slide.id}
            custom={dir}
            initial={{ opacity: 0, x: reduce ? 0 : dir * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : dir * -28 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {hasShot ? (
              <div className="relative">
                <ScreenshotFrame
                  src={slide.screenshotUrl!}
                  clickRect={rect}
                  highlight
                  zoom={rect ? 1.1 : undefined}
                  onAdvance={atEnd ? undefined : () => go(1)}
                  chromeActions={chromeActions}
                />
                {callout}
              </div>
            ) : (
              <div className="bg-card overflow-hidden rounded-xl border">
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                  <span className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
                    Step {index + 1} / {slides.length}
                  </span>
                  <div className="flex items-center gap-0.5">{chromeActions}</div>
                </div>
                <div className="flex min-h-[280px] items-center justify-center p-10">
                  <RichText
                    html={slide.content}
                    className="max-w-lg text-center text-xl [overflow-wrap:anywhere]"
                  />
                </div>
              </div>
            )}
          </m.div>
        </AnimatePresence>

        {/* Bottom nav — prev · counter · next, plus a dot scrubber. */}
        <div className="mt-5 flex items-center justify-center gap-4">
          <NavButton onClick={() => go(-1)} disabled={atStart} label="Previous">
            <ChevronLeft className="size-4" />
          </NavButton>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {index + 1} / {slides.length}
          </span>
          <NavButton onClick={() => go(1)} disabled={atEnd} label="Next">
            <ChevronRight className="size-4" />
          </NavButton>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Go to ${i + 1}`}
              onClick={() => {
                setDir(i > index ? 1 : -1)
                setIndex(i)
              }}
              className={
                i === index
                  ? "bg-primary h-1.5 w-6 rounded-full transition-all"
                  : "bg-border hover:bg-muted-foreground/40 h-1.5 w-1.5 rounded-full transition-all"
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/** The Guidejar-style instruction bubble — primary card, tail, counter, nav. */
function Callout({
  style,
  onRight,
  html,
  index,
  total,
  atStart,
  atEnd,
  onPrev,
  onNext,
}: {
  style: React.CSSProperties
  onRight: boolean
  html: string
  index: number
  total: number
  atStart: boolean
  atEnd: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div
      className="bg-primary text-primary-foreground group/callout absolute z-20 w-64 max-w-[75%] rounded-xl shadow-[0_16px_40px_-12px_color-mix(in_srgb,var(--primary)_70%,transparent)] ring-1 ring-white/10 transition-[box-shadow] hover:ring-2 hover:ring-[var(--primary-hover)]"
      style={style}
    >
      {/* Tail pointing back at the click. */}
      <span
        aria-hidden
        className={cn(
          "bg-primary absolute top-1/2 size-3 -translate-y-1/2 rotate-45",
          onRight ? "-left-1" : "-right-1"
        )}
      />
      <div className="relative p-3.5">
        <RichText
          html={html}
          className="text-[15px] leading-snug font-semibold [overflow-wrap:anywhere]"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-primary-foreground/70 font-mono text-[11px] tabular-nums">
            {index + 1} / {total}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onPrev}
              disabled={atStart}
              aria-label="Previous step"
              className="flex size-7 items-center justify-center rounded-md bg-white/15 transition hover:bg-white/25 active:scale-90 disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={onNext}
              disabled={atEnd}
              aria-label="Next step"
              className="text-primary flex size-7 items-center justify-center rounded-md bg-white shadow-sm transition hover:bg-white/90 active:scale-90 disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="hover:bg-muted flex size-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/** A control in the screenshot's chrome bar (restart / full screen). */
function ChromeButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors"
    >
      {children}
    </button>
  )
}
