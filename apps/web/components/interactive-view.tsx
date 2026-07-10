"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { RichText } from "@/components/rich-text"
import { ScreenshotFrame } from "@/components/screenshot-frame"
import type { GuideBlock } from "@/lib/guides"

/**
 * Interactive walkthrough — one STEP at a time: the screenshot with the
 * target spotlit, the pointer, a slight zoom, and an instruction callout
 * near the pointer. Arrow keys navigate. (Headings/tips/alerts are a
 * list-view concept and don't appear here.)
 */
export function InteractiveView({ blocks }: { blocks: GuideBlock[] }) {
  const slides = React.useMemo(
    () => blocks.filter((b) => b.type === "STEP"),
    [blocks]
  )
  const [index, setIndex] = React.useState(0)

  const go = React.useCallback(
    (delta: number) =>
      setIndex((i) => Math.min(Math.max(i + delta, 0), slides.length - 1)),
    [slides.length]
  )

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1)
      if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
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

  // Float the instruction callout near the pointer, opposite side, clamped.
  const cx = rect ? (rect.x + rect.w / 2) * 100 : 50
  const cy = rect ? (rect.y + rect.h / 2) * 100 : 50
  const onRight = cx <= 55
  const clamp = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, n))
  const calloutStyle: React.CSSProperties = {
    top: `${clamp(cy, 16, 84)}%`,
    transform: "translateY(-50%)",
    ...(onRight
      ? { left: `calc(${clamp(cx, 2, 55)}% + 26px)` }
      : { right: `calc(${clamp(100 - cx, 2, 55)}% + 26px)` }),
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative">
        {hasShot ? (
          <>
            <ScreenshotFrame
              src={slide.screenshotUrl!}
              clickRect={rect}
              spotlight
              zoom={rect ? 1.1 : undefined}
            />
            <div
              className="bg-card absolute z-10 w-56 max-w-[70%] rounded-lg border p-3 shadow-xl"
              style={calloutStyle}
            >
              <RichText html={slide.content} className="text-[13px] leading-snug" />
            </div>
          </>
        ) : (
          <div className="bg-card flex min-h-[320px] items-center justify-center rounded-xl border p-10">
            <RichText
              html={slide.content}
              className="max-w-lg text-center text-xl"
            />
          </div>
        )}

        <EdgeChevron side="left" onClick={() => go(-1)} disabled={atStart} />
        <EdgeChevron side="right" onClick={() => go(1)} disabled={atEnd} />
      </div>

      {/* Controls */}
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
            onClick={() => setIndex(i)}
            className={
              i === index
                ? "bg-viridian h-1.5 w-6 rounded-full transition-all"
                : "bg-border hover:bg-muted-foreground/40 h-1.5 w-1.5 rounded-full transition-all"
            }
          />
        ))}
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

function EdgeChevron({
  side,
  onClick,
  disabled,
}: {
  side: "left" | "right"
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={cn(
        "bg-card/90 absolute top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-md backdrop-blur transition-opacity disabled:opacity-0",
        side === "left" ? "-left-4" : "-right-4"
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="size-5" />
      ) : (
        <ChevronRight className="size-5" />
      )}
    </button>
  )
}
