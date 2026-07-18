"use client"

import * as React from "react"
import { m, useReducedMotion } from "motion/react"
import {
  Captions,
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
import { useGuideTrackerContext } from "@/lib/guide-tracker"
import {
  buildInteractiveSequence,
  EMPTY_PRESENTATION,
  type InteractivePresentation,
  type PresentationSlide,
} from "@workspace/contracts/guide"

import type { ClickRect, GuideBlock } from "@/lib/guides"

type WalkthroughSlide = PresentationSlide
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
  presentation,
  narration,
}: {
  blocks: GuideBlock[]
  /** Slides + per-step presentation. Steps come from `blocks` (canonical); the
   *  render sequence is computed from Steps + presentation. */
  presentation?: InteractivePresentation
  /** Voiceover audio per anchor (Step.key / slide.key). When present, playback
   *  plays each frame's narration and advances on audio end; frames without
   *  audio fall back to the timer. */
  narration?: Record<string, { audioUrl: string }>
}) {
  const wv = useGuideCustomization().walkthroughView
  const hotspot = useGuideCustomization().general.hotspot
  const frames = React.useMemo<Frame[]>(() => {
    const pres = presentation ?? EMPTY_PRESENTATION
    const steps = blocks.filter(
      (b) => b.type === "STEP" || b.type === "OUTCOME"
    )
    const { sequence } = buildInteractiveSequence(steps, pres)
    return sequence.map((f): Frame => {
      if (f.kind === "slide") {
        return { kind: "slide", id: f.slide.key, slide: f.slide }
      }
      const b = f.step
      const sp = pres.stepPresentation[b.key]
      return {
        kind: "step",
        id: b.key,
        screenshotUrl: b.screenshotUrl,
        clickRect: b.clickRect,
        content: b.content,
        calloutBg: sp?.appearance.calloutBackground ?? null,
        calloutText: sp?.appearance.calloutText ?? null,
      }
    })
  }, [presentation, blocks])
  // The first screenshot's rendered height — used to size slides so every frame
  // in the walkthrough is the same height (a constant stage).
  const firstStepUrl = React.useMemo(() => {
    for (const f of frames) if (f.kind === "step" && f.screenshotUrl) return f.screenshotUrl
    return null
  }, [frames])
  const [index, setIndex] = React.useState(0)
  // Whether the last move came from clicking the on-image target (snappier).
  const [fast, setFast] = React.useState(false)

  // Analytics: walkthrough entered (once), each frame reached (deduped by the
  // tracker), and completion on the final frame. Inert outside a reader.
  const { track } = useGuideTrackerContext()
  React.useEffect(() => {
    track("walkthrough_start")
  }, [track])
  React.useEffect(() => {
    if (frames.length === 0) return
    track("walkthrough_step", { stepIndex: index })
    if (index >= frames.length - 1) track("complete")
  }, [index, frames.length, track])
  const [fullscreen, setFullscreen] = React.useState(false)
  // Reserve the image's height so remounting the screenshot on step change
  // never collapses the layout (which would clamp the page scroll toward top).
  const [stageH, setStageH] = React.useState<number>()
  // The screenshot's aspect ratio (w/h), so fullscreen can scale the player to
  // fill the screen while keeping the image undistorted.
  const [aspect, setAspect] = React.useState<number>()
  const reduce = useReducedMotion()
  const rootRef = React.useRef<HTMLDivElement>(null)

  const autoplay = wv.autoplay
  const music = wv.backgroundMusic
  const voice = wv.voice
  const audioRef = React.useRef<HTMLAudioElement>(null)

  // ── Narration voiceover ──────────────────────────────────────────────────
  const narrationRef = React.useRef<HTMLAudioElement | null>(null)
  const currentFrameId = frames[index]?.id
  const rawAudio = currentFrameId
    ? (narration?.[currentFrameId]?.audioUrl ?? null)
    : null
  // If a frame's audio fails to load, treat it as audio-less so the timer takes
  // over (graceful fallback). Reset the error flag when the frame changes.
  const [audioErrored, setAudioErrored] = React.useState(false)
  React.useEffect(() => setAudioErrored(false), [currentFrameId])
  const currentAudio = audioErrored ? null : rawAudio
  const hasNarration = !!narration && Object.keys(narration).length > 0
  const [speaking, setSpeaking] = React.useState(false)

  // "Sound" = background music or voiceover. When present, the player shows a
  // center Play button first (a gesture is required to start audio anyway), and
  // ONE play/pause + ONE mute drive BOTH tracks together.
  const hasSound = !!music.url || hasNarration
  const [started, setStarted] = React.useState(!hasSound)
  const [playing, setPlaying] = React.useState(!hasSound && autoplay.enabled)
  const [muted, setMuted] = React.useState(false)
  // Whether the on-image caption (the instruction callout) is shown — toggled by
  // the CC control. On by default.
  const [captions, setCaptions] = React.useState(true)
  // 0–1 progress of the CURRENT step, for the timeline's active segment. Fed by
  // the narration audio's timeupdate, or a timer for audio-less frames.
  const [progress, setProgress] = React.useState(0)
  React.useEffect(() => setProgress(0), [index])
  // Timeline shows only while the cursor is in the bottom ~20% of the stage
  // (tracked by pointer position so it never blocks clicks on the screenshot).
  const [showTimeline, setShowTimeline] = React.useState(false)
  React.useEffect(() => {
    if (!hasSound) setStarted(true)
  }, [hasSound])

  // Background music follows the master play/pause + mute, ducking under voice.
  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio || !music.url) return
    audio.loop = true
    audio.muted = muted
    audio.volume = music.volume * (speaking ? 0.55 : 1)
    if (playing) void audio.play().catch(() => {})
    else audio.pause()
  }, [playing, muted, speaking, music.url, music.volume])

  // Load the current frame's narration audio (reset to the start).
  React.useEffect(() => {
    const el = narrationRef.current
    if (!el) return
    if (currentAudio) {
      el.src = currentAudio
      el.currentTime = 0
    } else {
      el.removeAttribute("src")
    }
  }, [currentAudio])

  // Narration follows the master play/pause + mute; it keeps advancing when
  // muted (mute only silences), so the walkthrough still progresses.
  React.useEffect(() => {
    const el = narrationRef.current
    if (!el || !currentAudio) {
      setSpeaking(false)
      return
    }
    el.muted = muted
    el.playbackRate = voice.speed
    if (playing) {
      void el.play().then(() => setSpeaking(true)).catch(() => setSpeaking(false))
    } else {
      el.pause()
      setSpeaking(false)
    }
  }, [playing, currentAudio, muted, voice.speed])

  // Advance when a frame's narration finishes (audio-driven auto-advance).
  const onNarrationEnded = React.useCallback(() => {
    setSpeaking(false)
    setFast(false)
    setIndex((i) => {
      if (i >= frames.length - 1) {
        if (!autoplay.loop) setPlaying(false)
        return autoplay.loop ? 0 : i
      }
      return i + 1
    })
  }, [frames.length, autoplay.loop])

  // Manual navigation. `viaClick` = the viewer clicked the on-image target,
  // so the transition is snappier than an arrow press. Navigation does NOT stop
  // playback — advancing while playing keeps the audio flowing into the next
  // step's narration (and the background music never pauses).
  const go = React.useCallback(
    (delta: number, viaClick = false) => {
      setFast(viaClick)
      setIndex((i) => Math.min(Math.max(i + delta, 0), frames.length - 1))
    },
    [frames.length]
  )

  const jumpTo = React.useCallback((i: number) => {
    setFast(false)
    setIndex(i)
  }, [])

  const restart = React.useCallback(() => {
    setPlaying(false)
    setFast(false)
    setIndex(0)
  }, [])

  // The center Play overlay (shown once, before the first play when there's
  // sound) and the chrome Play/Pause both drive playback + start from the top
  // if we're at the end.
  const startPlayback = React.useCallback(() => {
    setStarted(true)
    if (index >= frames.length - 1) setIndex(0)
    setPlaying(true)
  }, [index, frames.length])

  const togglePlay = React.useCallback(() => {
    setStarted(true)
    if (!playing && index >= frames.length - 1) setIndex(0)
    setPlaying((p) => !p)
  }, [playing, index, frames.length])

  const toggleFullscreen = React.useCallback(() => {
    if (typeof document === "undefined") return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void rootRef.current?.requestFullscreen().catch(() => {})
  }, [])

  // Autoplay — advance on a timer at the normal (non-click) speed. Frames WITH
  // narration audio advance on audio-end instead (see onNarrationEnded), so the
  // timer only drives audio-less frames (the graceful fallback).
  React.useEffect(() => {
    if (!playing || currentAudio) return
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
  }, [playing, index, frames.length, autoplay.loop, autoplay.delaySeconds, currentAudio])

  // Drive the timeline's progress for audio-less frames (narration frames get
  // their progress from the audio's timeupdate instead).
  React.useEffect(() => {
    if (!playing || currentAudio) return
    const dur = Math.max(0.5, autoplay.delaySeconds) * 1000
    let start = 0
    let raf = 0
    const tick = (t: number) => {
      if (!start) start = t
      const p = Math.min(1, (t - start) / dur)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, currentAudio, index, autoplay.delaySeconds])

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
      {(hasSound || autoplay.enabled) && (
        <ChromeButton label={playing ? "Pause" : "Play"} onClick={togglePlay}>
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
      {hasSound && (
        <ChromeButton label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
          {muted ? (
            <VolumeX className="size-3.5" />
          ) : (
            <Volume2 className="size-3.5" />
          )}
        </ChromeButton>
      )}
      {wv.textAnnotations && (
        <ChromeButton
          label={captions ? "Hide captions" : "Show captions"}
          onClick={() => setCaptions((c) => !c)}
          active={captions}
        >
          <Captions className="size-3.5" />
        </ChromeButton>
      )}
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
        "mx-auto max-w-6xl",
        fullscreen &&
          "bg-background flex h-full max-w-none items-center justify-center p-4"
      )}
    >
      {music.url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audioRef} src={music.url} loop preload="auto" />
      )}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={narrationRef}
        onEnded={onNarrationEnded}
        onError={() => setAudioErrored(true)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget
          if (el.duration && Number.isFinite(el.duration)) setProgress(el.currentTime / el.duration)
        }}
        preload="auto"
      />
      {speaking && <span className="sr-only" role="status">Narration playing</span>}
      <div
        className={cn("w-full", fullscreen && "max-w-none")}
        style={
          fullscreen && aspect
            ? { width: `min(96vw, calc(92vh * ${aspect.toFixed(3)}))` }
            : undefined
        }
      >
        {/* Off-layout measurer: keeps `stageH` warm from the first screenshot so
            slides match the step height even before a step is viewed. */}
        {firstStepUrl && (
          <div aria-hidden className="pointer-events-none h-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={firstStepUrl}
              alt=""
              className="w-full"
              onLoad={(e) => {
                setStageH(e.currentTarget.offsetHeight)
                setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)
              }}
            />
          </div>
        )}
        <div
          className="bg-card relative overflow-hidden rounded-xl border"
          data-step-key={stepFrame ? currentFrameId : undefined}
        >
          {/* Window chrome — traffic lights + controls (Guidejar-style). */}
          <div className="flex items-center justify-between gap-2 bg-[#374151] px-3 py-1">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex items-center gap-0.5">{chromeActions}</div>
          </div>

          {/* Stage — screenshot / slide, with the overlays + hover timeline. */}
          <div
            className="relative"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              const inZone = e.clientY - r.top > r.height * 0.8
              setShowTimeline((v) => (v === inZone ? v : inZone))
            }}
            onMouseLeave={() => setShowTimeline(false)}
          >
            {/* Center Play — shown once before the first play when the
                walkthrough has sound (bg music or voiceover). */}
            {hasSound && !started && (
              <button
                type="button"
                onClick={startPlayback}
                aria-label="Play walkthrough"
                className="absolute inset-0 z-40 flex items-center justify-center bg-black/25 backdrop-blur-[1px] transition-colors hover:bg-black/30"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-white/95 shadow-[0_10px_40px_-8px_rgba(0,0,0,0.5)] transition-transform hover:scale-105">
                  <Play className="ml-1 size-7 fill-zinc-900 text-zinc-900" />
                </span>
              </button>
            )}

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
                    onLoad={(e) => {
                      setStageH(e.currentTarget.offsetHeight)
                      setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)
                    }}
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

              {/* Callout (the "caption") — floats beside the pointer. Toggled
                  by CC, and hidden until playback has started. */}
              {wv.textAnnotations && captions && started && (
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

            {/* Edge chevrons — prev/next over the stage. */}
            {!atStart && <EdgeChevron side="left" onClick={() => go(-1)} />}
            {!atEnd && <EdgeChevron side="right" onClick={() => go(1)} />}

            {/* Hover timeline — segmented scrubber revealed on bottom hover. */}
            <TimelineScrubber total={frames.length} index={index} progress={progress} show={showTimeline} onSeek={jumpTo} />
          </div>
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

/** A large prev/next chevron floating over the stage edge (Guidejar-style). */
function EdgeChevron({
  side,
  onClick,
}: {
  side: "left" | "right"
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={cn(
        // Almost transparent — just a hint of a button — until hovered. The
        // drop-shadow keeps the arrow legible over both light and dark shots.
        "absolute top-1/2 z-30 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/15 text-white/80 backdrop-blur-[1px] transition hover:bg-black/50 hover:text-white active:scale-90 [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]",
        side === "left" ? "left-2.5" : "right-2.5"
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

/** A control in the screenshot's chrome bar (play / restart / full screen). */
function ChromeButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick: () => void
  /** Toggle controls (e.g. captions) that stay lit while enabled. */
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex size-5 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-white/15 text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      {children}
    </button>
  )
}

/**
 * The hover-reveal timeline — a segmented scrubber along the bottom of the
 * player (Guidejar-style). Completed steps fill with the accent; every segment
 * is clickable to jump. Fades in when the stage is hovered.
 */
function TimelineScrubber({
  total,
  index,
  progress,
  show,
  onSeek,
}: {
  total: number
  index: number
  /** 0–1 progress through the current step. */
  progress: number
  /** Reveal state (cursor in the bottom of the stage). */
  show: boolean
  onSeek: (i: number) => void
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end px-3 pt-12 pb-2.5 transition-opacity duration-200",
        show ? "opacity-100" : "opacity-0"
      )}
      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)" }}
    >
      <div className={cn("flex w-full items-center gap-1.5", show ? "pointer-events-auto" : "pointer-events-none")}>
        {Array.from({ length: total }).map((_, i) => {
          const active = i === index
          const done = i < index
          return (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              onClick={() => onSeek(i)}
              // The active step is a wider pill that fills as it plays.
              className={cn("group/seg py-2", active ? "flex-[2.5]" : "flex-1")}
            >
              <span
                className={cn(
                  "relative block h-1.5 overflow-hidden rounded-full",
                  done ? "bg-white" : "bg-white/35 group-hover/seg:bg-white/55"
                )}
              >
                {active && (
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-150 ease-linear"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
