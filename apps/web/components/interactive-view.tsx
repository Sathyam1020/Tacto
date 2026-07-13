"use client"

import * as React from "react"
import { m, useReducedMotion } from "motion/react"
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { useGuideCustomization } from "@/components/guide-customization-context"
import { RichText } from "@/components/rich-text"
import { HotspotGlyph } from "@/components/screenshot-frame"
import type {
  ClickRect,
  GuideBlock,
  WalkthroughItemClient,
} from "@/lib/guides"

type WalkthroughSlide = Exclude<WalkthroughItemClient, { kind: "step" }>
type SlideDestination = WalkthroughSlide["buttons"][number]["destination"]
/** A single frame in the walkthrough — a step (screenshot + callout) or an
 *  intro/chapter slide. */
type Frame =
  | {
      kind: "step"
      id: string
      screenshotUrl: string | null
      clickRect: ClickRect | null
      content: string
      calloutBg: string | null
      calloutText: string | null
    }
  | { kind: "slide"; id: string; slide: WalkthroughSlide }

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/**
 * Interactive walkthrough — one STEP at a time on a single stage. The
 * screenshot zooms toward the click, a pointer sits on it, and a compact
 * Guidejar-style callout floats beside it with its tail locked onto the
 * pointer. Advancing carries the pointer and callout from the previous step's
 * position to the current one; clicking the on-image target advances faster
 * than the arrows. Click the target, the callout arrows, the bottom nav, or the
 * arrow keys to move. (Headings/tips/alerts are a list-view concept and don't
 * appear here.)
 */
export function InteractiveView({
  blocks,
  items,
}: {
  blocks: GuideBlock[]
  /** The Interactive tree's items (steps + intro/chapter slides). When present,
   *  the walkthrough renders from this independent tree; otherwise it falls back
   *  to the List blocks. */
  items?: WalkthroughItemClient[]
}) {
  const wv = useGuideCustomization().walkthroughView
  const hotspot = useGuideCustomization().general.hotspot
  const frames = React.useMemo<Frame[]>(() => {
    if (items) {
      return items.map((it) =>
        it.kind === "step"
          ? {
              kind: "step",
              id: it.key,
              screenshotUrl: it.screenshotUrl,
              clickRect: it.clickRect,
              content: it.content,
              calloutBg: it.calloutBg,
              calloutText: it.calloutText,
            }
          : { kind: "slide", id: it.key, slide: it }
      )
    }
    return blocks
      .filter((b) => b.type === "STEP" || b.type === "OUTCOME")
      .map((b) => ({
        kind: "step",
        id: b.id,
        screenshotUrl: b.screenshotUrl,
        clickRect: b.clickRect,
        content: b.content,
        calloutBg: null,
        calloutText: null,
      }))
  }, [items, blocks])
  // The first screenshot's rendered height — used to size slides so every frame
  // in the walkthrough is the same height (a constant stage).
  const firstStepUrl = React.useMemo(() => {
    for (const f of frames) if (f.kind === "step" && f.screenshotUrl) return f.screenshotUrl
    return null
  }, [frames])
  const [index, setIndex] = React.useState(0)
  // Whether the last move came from clicking the on-image target (snappier).
  const [fast, setFast] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(false)
  // Reserve the image's height so remounting the screenshot on step change
  // never collapses the layout (which would clamp the page scroll toward top).
  const [stageH, setStageH] = React.useState<number>()
  const reduce = useReducedMotion()
  const rootRef = React.useRef<HTMLDivElement>(null)

  const autoplay = wv.autoplay
  const [playing, setPlaying] = React.useState(autoplay.enabled)
  React.useEffect(() => setPlaying(autoplay.enabled), [autoplay.enabled])

  // Background music — loops during the walkthrough. Browsers block autoplay of
  // sound until a gesture, so we also start it on the first click.
  const music = wv.backgroundMusic
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [musicOn, setMusicOn] = React.useState(false)
  React.useEffect(() => {
    if (audioRef.current) audioRef.current.volume = music.volume
  }, [music.volume])
  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio || !music.url) return
    audio.volume = music.volume
    void audio.play().then(() => setMusicOn(true)).catch(() => {})
    function onGesture() {
      if (audio && audio.paused) {
        void audio.play().then(() => setMusicOn(true)).catch(() => {})
      }
      window.removeEventListener("pointerdown", onGesture)
    }
    window.addEventListener("pointerdown", onGesture)
    return () => {
      window.removeEventListener("pointerdown", onGesture)
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music.url])
  const toggleMusic = React.useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play().then(() => setMusicOn(true)).catch(() => {})
    else {
      audio.pause()
      setMusicOn(false)
    }
  }, [])

  // Manual navigation. `viaClick` = the viewer clicked the on-image target,
  // so the transition is snappier than an arrow press.
  const go = React.useCallback(
    (delta: number, viaClick = false) => {
      setPlaying(false)
      setFast(viaClick)
      setIndex((i) => Math.min(Math.max(i + delta, 0), frames.length - 1))
    },
    [frames.length]
  )

  const jumpTo = React.useCallback((i: number) => {
    setPlaying(false)
    setFast(false)
    setIndex(i)
  }, [])

  const restart = React.useCallback(() => {
    setPlaying(false)
    setFast(false)
    setIndex(0)
  }, [])

  const toggleFullscreen = React.useCallback(() => {
    if (typeof document === "undefined") return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void rootRef.current?.requestFullscreen().catch(() => {})
  }, [])

  // Autoplay — advance on a timer at the normal (non-click) speed.
  React.useEffect(() => {
    if (!playing) return
    const t = setTimeout(
      () => {
        setFast(false)
        if (index >= frames.length - 1) {
          if (autoplay.loop) setIndex(0)
          else setPlaying(false)
        } else {
          setIndex(index + 1)
        }
      },
      Math.max(0.5, autoplay.delaySeconds) * 1000
    )
    return () => clearTimeout(t)
  }, [playing, index, frames.length, autoplay.loop, autoplay.delaySeconds])

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

  if (frames.length === 0) {
    return (
      <p className="text-muted-foreground py-24 text-center font-serif text-lg">
        This guide has no steps to walk through yet.
      </p>
    )
  }

  const frame = frames[index]!
  const stepFrame = frame.kind === "step" ? frame : null
  const atStart = index === 0
  const atEnd = index === frames.length - 1
  const hasShot = !!stepFrame?.screenshotUrl
  const rect = hasShot ? stepFrame!.clickRect : null

  // Pointer center (percent of the image). Falls back to the middle.
  const cx = rect ? (rect.x + rect.w / 2) * 100 : 50
  const cy = rect ? (rect.y + rect.h / 2) * 100 : 50
  // Callout goes on the side with more room; tail points back at the pointer.
  const onRight = cx <= 50
  const effZoom = rect && wv.zoomLevel > 1 ? wv.zoomLevel : 1

  // Slide-button navigation: next/prev or jump to a specific step.
  const navigate = (dest: SlideDestination) => {
    if (dest.kind === "next") go(1)
    else if (dest.kind === "prev") go(-1)
    else {
      const i = frames.findIndex(
        (f) => f.kind === "step" && f.id === dest.stepKey
      )
      if (i >= 0) jumpTo(i)
    }
  }

  const travelT = { duration: reduce ? 0 : fast ? 0.28 : 0.5, ease: EASE }
  const zoomInT = reduce
    ? { duration: 0 }
    : { delay: fast ? 0.08 : 0.22, duration: 0.7, ease: EASE }
  const fadeT = { duration: reduce ? 0 : fast ? 0.14 : 0.26 }

  const chromeActions = (
    <>
      {music.url && (
        <ChromeButton
          label={musicOn ? "Mute music" : "Play music"}
          onClick={toggleMusic}
        >
          {musicOn ? (
            <Volume2 className="size-3.5" />
          ) : (
            <VolumeX className="size-3.5" />
          )}
        </ChromeButton>
      )}
      {autoplay.enabled && (
        <ChromeButton
          label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
        </ChromeButton>
      )}
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

  return (
    <div
      ref={rootRef}
      className={cn(
        "mx-auto max-w-4xl",
        fullscreen &&
          "bg-background flex h-full max-w-none items-center justify-center px-6"
      )}
    >
      {music.url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audioRef} src={music.url} loop preload="auto" />
      )}
      <div className={cn("w-full", fullscreen && "max-w-6xl")}>
        {/* Off-layout measurer: keeps `stageH` warm from the first screenshot so
            slides match the step height even before a step is viewed. */}
        {firstStepUrl && (
          <div aria-hidden className="pointer-events-none h-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={firstStepUrl}
              alt=""
              className="w-full"
              onLoad={(e) => setStageH(e.currentTarget.offsetHeight)}
            />
          </div>
        )}
        <div className="bg-card overflow-hidden rounded-xl border">
          <ChromeBar actions={chromeActions} />

          {frame.kind === "slide" ? (
            <SlideFrame
              slide={frame.slide}
              onNavigate={navigate}
              minH={stageH}
            />
          ) : hasShot ? (
            // The stage: image + pointer + callout share one coordinate space
            // (percent of the image), so the tail always lands on the pointer.
            <div className="relative" style={{ minHeight: stageH }}>
              {/* Image — clips its own zoom; everything else floats above it. */}
              <div className="overflow-hidden">
                <m.div
                  key={frame.id}
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: effZoom, opacity: 1 }}
                  transition={{
                    scale: effZoom > 1 ? zoomInT : { duration: 0 },
                    opacity: fadeT,
                  }}
                  style={{ transformOrigin: `${cx}% ${cy}%` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={stepFrame!.screenshotUrl!}
                    alt=""
                    className="block w-full"
                    onLoad={(e) => setStageH(e.currentTarget.offsetHeight)}
                  />
                </m.div>
              </div>

              {/* Click target — advances (snappier) when tapped. */}
              {rect && !atEnd && (
                <m.button
                  aria-label="Next step"
                  onClick={() => go(1, true)}
                  className="absolute z-[15] cursor-pointer"
                  initial={false}
                  animate={{
                    left: `${Math.max(0, (rect.x - 0.02) * 100)}%`,
                    top: `${Math.max(0, (rect.y - 0.02) * 100)}%`,
                    width: `${(rect.w + 0.04) * 100}%`,
                    height: `${(rect.h + 0.04) * 100}%`,
                  }}
                  transition={travelT}
                />
              )}

              {/* Traveling pointer. */}
              {rect &&
                (hotspot.type === "highlight-box" ? (
                  <m.div
                    className="pointer-events-none absolute z-10 rounded-md ring-2 ring-[var(--primary)]"
                    initial={false}
                    animate={{
                      left: `${Math.max(0, (rect.x - 0.008 * hotspot.size) * 100)}%`,
                      top: `${Math.max(0, (rect.y - 0.008 * hotspot.size) * 100)}%`,
                      width: `${(rect.w + 0.016 * hotspot.size) * 100}%`,
                      height: `${(rect.h + 0.016 * hotspot.size) * 100}%`,
                    }}
                    transition={travelT}
                    style={{
                      boxShadow:
                        "0 0 0 4px color-mix(in srgb, var(--primary) 22%, transparent)",
                    }}
                  />
                ) : (
                  <m.div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 text-primary"
                    initial={false}
                    animate={{ left: `${cx}%`, top: `${cy}%` }}
                    transition={travelT}
                  >
                    <span
                      className="block"
                      style={{ transform: `scale(${hotspot.size})` }}
                    >
                      <HotspotGlyph type={hotspot.type} />
                    </span>
                  </m.div>
                ))}

              {/* Callout — floats beside the pointer, tail on the pointer. */}
              {wv.textAnnotations && (
                <Callout
                  cx={cx}
                  cy={cy}
                  onRight={onRight}
                  transition={travelT}
                  html={stepFrame!.content}
                  bg={stepFrame!.calloutBg}
                  textColor={stepFrame!.calloutText}
                  index={index}
                  total={frames.length}
                  atStart={atStart}
                  atEnd={atEnd}
                  showCounter={wv.showStepCounter}
                  markdown={wv.useMarkdown}
                  optimizeForMobile={wv.optimizeForMobile}
                  onPrev={() => go(-1)}
                  onNext={() => go(1)}
                />
              )}
            </div>
          ) : (
            // Steps without a screenshot — the instruction, centered.
            <div className="flex min-h-[280px] items-center justify-center p-10">
              <RichText
                html={stepFrame!.content}
                className="max-w-lg text-center text-xl [overflow-wrap:anywhere]"
              />
            </div>
          )}
        </div>

        {/* Bottom nav — prev · counter · next, plus a dot scrubber. */}
        <div className="mt-5 flex items-center justify-center gap-4">
          <NavButton onClick={() => go(-1)} disabled={atStart} label="Previous">
            <ChevronLeft className="size-4" />
          </NavButton>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {index + 1} / {frames.length}
          </span>
          <NavButton onClick={() => go(1)} disabled={atEnd} label="Next">
            <ChevronRight className="size-4" />
          </NavButton>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          {frames.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Go to ${i + 1}`}
              onClick={() => jumpTo(i)}
              className={
                i === index
                  ? "bg-primary h-1.5 w-6 rounded-full transition-all"
                  : "bg-border hover:bg-muted-foreground/40 h-1.5 w-1.5 rounded-full transition-all"
              }
            />
          ))}
        </div>

        {wv.cta.enabled && atEnd && <CtaCard cta={wv.cta} />}
      </div>
    </div>
  )
}

/** First block/line of rich-text HTML — used when Markdown is disabled. */
function firstLine(html: string): string {
  const p = html.match(/<p[^>]*>[\s\S]*?<\/p>/i)
  if (p) return p[0]
  return html.split(/<br\s*\/?>|\n/i)[0] ?? html
}

/** The compact instruction bubble, positioned at the pointer with a tail. */
function Callout({
  cx,
  cy,
  onRight,
  transition,
  html,
  bg,
  textColor,
  index,
  total,
  atStart,
  atEnd,
  showCounter,
  markdown,
  optimizeForMobile,
  onPrev,
  onNext,
}: {
  cx: number
  cy: number
  onRight: boolean
  transition: { duration: number; ease?: [number, number, number, number] }
  html: string
  bg: string | null
  textColor: string | null
  index: number
  total: number
  atStart: boolean
  atEnd: boolean
  showCounter: boolean
  markdown: boolean
  optimizeForMobile: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const GAP = 34
  // "Use Markdown" off → show only the first line as plain text.
  const displayHtml = markdown ? html : firstLine(html)
  return (
    <m.div
      // The box is the positioned element: its vertical center sits on the
      // pointer (translateY -50%) and it's pushed to the roomier side, so the
      // tail (at the box's vertical center) lands exactly on the pointer.
      className={cn(
        "absolute z-20 w-[236px] max-w-[70%] rounded-xl p-3 shadow-[0_16px_40px_-12px_color-mix(in_srgb,var(--primary)_70%,transparent)] ring-1 ring-white/10 transition-[box-shadow] duration-150",
        !bg && "bg-primary",
        !textColor && "text-primary-foreground",
        // Guidejar-style hover outline — same accent, softer, with a small gap.
        "hover:ring-2 hover:ring-primary/50 hover:ring-offset-2 hover:ring-offset-transparent",
        // Mobile: dock to the bottom of the stage instead of floating.
        optimizeForMobile &&
          "max-md:![transform:none] max-md:!inset-x-3 max-md:!top-auto max-md:!bottom-3 max-md:!w-auto max-md:!max-w-none"
      )}
      initial={false}
      animate={{ left: `${cx}%`, top: `${cy}%` }}
      transition={transition}
      style={{
        transform: onRight
          ? `translateY(-50%) translateX(${GAP}px)`
          : `translateY(-50%) translateX(calc(-100% - ${GAP}px))`,
        ...(bg ? { backgroundColor: bg } : {}),
        ...(textColor ? { color: textColor } : {}),
      }}
    >
      {/* Tail pointing back at the pointer. */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 size-3 -translate-y-1/2 rotate-45",
          !bg && "bg-primary",
          onRight ? "-left-1" : "-right-1",
          optimizeForMobile && "max-md:hidden"
        )}
        style={bg ? { backgroundColor: bg } : undefined}
      />
      <RichText
        html={displayHtml}
        className="text-sm leading-snug font-semibold [overflow-wrap:anywhere]"
      />
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {showCounter ? (
          <span className="text-primary-foreground/70 font-mono text-[11px] tabular-nums">
            {index + 1} / {total}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrev}
            disabled={atStart}
            aria-label="Previous step"
            className="flex size-6 items-center justify-center rounded-md bg-white/15 transition hover:bg-white/25 active:scale-90 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={onNext}
            disabled={atEnd}
            aria-label="Next step"
            className="text-primary flex size-6 items-center justify-center rounded-md bg-white shadow-sm transition hover:bg-white/90 active:scale-90 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </m.div>
  )
}

/** The end-of-walkthrough call-to-action (Interactive view). */
function CtaCard({
  cta,
}: {
  cta: {
    title: string
    subtitle: string
    buttonText: string
    buttonUrl: string
  }
}) {
  const hasButton = !!cta.buttonText && !!cta.buttonUrl
  if (!cta.title && !cta.subtitle && !hasButton) return null
  return (
    <div className="bg-card mt-6 rounded-xl border p-6 text-center">
      {cta.title && (
        <h3 className="text-lg font-semibold tracking-tight">{cta.title}</h3>
      )}
      {cta.subtitle && (
        <p className="text-muted-foreground mt-1 text-sm">{cta.subtitle}</p>
      )}
      {hasButton && (
        <a
          href={cta.buttonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground mt-4 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          {cta.buttonText}
        </a>
      )}
    </div>
  )
}

/** An intro/chapter slide in the player — title/subtitle + jump-to-step
 *  buttons, styled by the slide's appearance. */
function SlideFrame({
  slide,
  onNavigate,
  minH,
}: {
  slide: WalkthroughSlide
  onNavigate: (dest: SlideDestination) => void
  /** Match the step screenshot height so every frame is the same size. */
  minH?: number
}) {
  const a = slide.appearance
  const dark = a.theme === "dark"
  const bg = a.background.kind === "preset" ? a.background.value : null
  const alignClass =
    a.align === "left"
      ? "items-start text-left"
      : a.align === "right"
        ? "items-end text-right"
        : "items-center text-center"
  const colClass =
    a.buttonColumns === 3
      ? "grid-cols-3"
      : a.buttonColumns === 2
        ? "grid-cols-2"
        : "grid-cols-1"
  return (
    <div
      className={cn(
        "flex flex-col justify-center gap-4 px-12 py-16",
        alignClass,
        minH == null && "min-h-[440px]",
        !bg && (dark ? "bg-zinc-900" : "bg-white")
      )}
      style={{ minHeight: minH, ...(bg ? { background: bg } : {}) }}
    >
      {slide.title && (
        <h2
          className={cn(
            "font-serif text-4xl font-semibold tracking-tight [overflow-wrap:anywhere]",
            dark ? "text-white" : "text-zinc-900"
          )}
        >
          {slide.title}
        </h2>
      )}
      {slide.subtitle && (
        <p
          className={cn(
            "max-w-xl text-lg leading-relaxed [overflow-wrap:anywhere]",
            dark ? "text-white/70" : "text-zinc-500"
          )}
        >
          {slide.subtitle}
        </p>
      )}
      {slide.buttons.length > 0 && (
        <div className={cn("mt-4 grid w-full max-w-md gap-2.5", colClass)}>
          {slide.buttons.map((b) => (
            <button
              key={b.key}
              onClick={() => onNavigate(b.destination)}
              style={{ backgroundColor: b.bgColor, color: b.textColor }}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              {b.text || "Button"}
            </button>
          ))}
        </div>
      )}
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

/** The screenshot's chrome bar — traffic-light dots + right-aligned actions. */
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

/** A control in the screenshot's chrome bar (play / restart / full screen). */
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
