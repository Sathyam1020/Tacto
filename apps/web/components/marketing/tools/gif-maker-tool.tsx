"use client"

import * as React from "react"
import { Circle, Download, Loader2, Square } from "lucide-react"

import { encodeGif, type GifFrame } from "@/lib/marketing/gif-encoder"

type Phase = "idle" | "recording" | "encoding" | "done"

const FPS = 10
const MAX_W = 600
const MAX_FRAMES = 150 // ~15s at 10fps — keeps memory sane

export function GifMakerTool() {
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [url, setUrl] = React.useState("")
  const [frameCount, setFrameCount] = React.useState(0)
  const [supported, setSupported] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const streamRef = React.useRef<MediaStream | null>(null)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const framesRef = React.useRef<GifFrame[]>([])
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const dimsRef = React.useRef<{ w: number; h: number }>({ w: 0, h: 0 })

  React.useEffect(() => {
    setSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia)
    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const finish = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const frames = framesRef.current
    if (!frames.length) {
      setPhase("idle")
      return
    }
    setPhase("encoding")
    // Defer so the "encoding" state paints before the sync encode.
    setTimeout(() => {
      const { w, h } = dimsRef.current
      const bytes = encodeGif(frames, w, h)
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" })
      setUrl(URL.createObjectURL(blob))
      framesRef.current = []
      setPhase("done")
    }, 60)
  }, [])

  const start = async () => {
    setError(null)
    if (url) URL.revokeObjectURL(url)
    setUrl("")
    framesRef.current = []
    setFrameCount(0)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      streamRef.current = stream
      const video = document.createElement("video")
      video.srcObject = stream
      video.muted = true
      await video.play()
      videoRef.current = video

      const vw = video.videoWidth || 1280
      const vh = video.videoHeight || 720
      const scale = Math.min(1, MAX_W / vw)
      const w = Math.max(2, Math.round(vw * scale))
      const h = Math.max(2, Math.round(vh * scale))
      dimsRef.current = { w, h }
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      canvasRef.current = canvas
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!

      stream.getVideoTracks()[0]?.addEventListener("ended", finish)
      setPhase("recording")
      timerRef.current = setInterval(() => {
        ctx.drawImage(video, 0, 0, w, h)
        const data = ctx.getImageData(0, 0, w, h).data
        framesRef.current.push({ rgba: new Uint8Array(data), delayMs: 1000 / FPS })
        setFrameCount(framesRef.current.length)
        if (framesRef.current.length >= MAX_FRAMES) finish()
      }, 1000 / FPS)
    } catch (e) {
      const err = e as DOMException
      if (err?.name !== "NotAllowedError") setError("Couldn't start capture. Try a Chromium-based browser on desktop.")
      cleanup()
      setPhase("idle")
    }
  }

  if (!supported) {
    return (
      <p className="rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-canvas)] p-6 text-center text-[14px] text-[var(--l-ink-subtle)]">
        Screen capture isn&apos;t supported in this browser. Try the latest Chrome or Edge on desktop.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex aspect-video w-full max-w-3xl items-center justify-center overflow-hidden rounded-3xl border border-[var(--l-hairline)] bg-[var(--l-canvas)]">
        {phase === "done" && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Recorded GIF" className="max-h-full max-w-full" />
        ) : phase === "encoding" ? (
          <div className="flex flex-col items-center gap-3 text-[var(--l-ink-subtle)]">
            <Loader2 className="size-6 animate-spin text-cobalt" />
            <p className="text-[13px]">Encoding your GIF…</p>
          </div>
        ) : phase === "recording" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="relative flex size-4">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex size-4 rounded-full bg-red-500" />
            </span>
            <p className="font-mono text-lg tabular-nums text-[var(--l-ink)]">{frameCount} frames · {(frameCount / FPS).toFixed(1)}s</p>
            <p className="text-[13px] text-[var(--l-ink-subtle)]">Capturing… up to {(MAX_FRAMES / FPS).toFixed(0)}s. Nothing is uploaded.</p>
          </div>
        ) : (
          <p className="px-6 text-center text-[14px] text-[var(--l-ink-subtle)]">Record a region of your screen and it becomes an animated GIF — encoded right here in your browser.</p>
        )}
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {phase === "recording" ? (
          <button type="button" onClick={finish} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02]">
            <Square className="size-4 fill-white" /> Stop & make GIF
          </button>
        ) : (
          <button type="button" onClick={start} disabled={phase === "encoding"} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50">
            <Circle className="size-4 fill-white" /> {phase === "done" ? "Record another" : "Start capture"}
          </button>
        )}
        {phase === "done" && url && (
          <a href={url} download="tacto.gif" className="inline-flex items-center gap-2 rounded-xl border border-[var(--l-hairline-strong)] bg-white px-5 py-2.5 text-[14px] font-semibold text-[var(--l-ink)] transition-colors hover:bg-[var(--l-hover)]">
            <Download className="size-4" /> Download GIF
          </a>
        )}
      </div>
    </div>
  )
}
