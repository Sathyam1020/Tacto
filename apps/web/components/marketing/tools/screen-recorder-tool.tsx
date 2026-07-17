"use client"

import * as React from "react"
import { Circle, Download, Mic, Square } from "lucide-react"

type Phase = "idle" | "recording" | "done"

export function ScreenRecorderTool() {
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [withMic, setWithMic] = React.useState(false)
  const [url, setUrl] = React.useState<string>("")
  const [seconds, setSeconds] = React.useState(0)
  const [supported, setSupported] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const streamsRef = React.useRef<MediaStream[]>([])
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  React.useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getDisplayMedia &&
        typeof MediaRecorder !== "undefined"
    )
    return () => {
      streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const stopStreams = () => {
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    streamsRef.current = []
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const start = async () => {
    setError(null)
    if (url) URL.revokeObjectURL(url)
    setUrl("")
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const tracks = [...display.getTracks()]
      streamsRef.current = [display]
      if (withMic) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
          streamsRef.current.push(mic)
          mic.getAudioTracks().forEach((t) => tracks.push(t))
        } catch {
          /* mic denied — record without it */
        }
      }
      const combined = new MediaStream(tracks)
      const rec = new MediaRecorder(combined, { mimeType: pickMime() })
      chunksRef.current = []
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      rec.onstop = () => {
        stopStreams()
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" })
        setUrl(URL.createObjectURL(blob))
        setPhase("done")
      }
      // When the user clicks the browser's native "Stop sharing", end cleanly.
      display.getVideoTracks()[0]?.addEventListener("ended", () => rec.state !== "inactive" && rec.stop())
      rec.start()
      recorderRef.current = rec
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      setPhase("recording")
    } catch (e) {
      const err = e as DOMException
      if (err?.name !== "NotAllowedError") setError("Couldn't start recording. Try again, or use a Chromium-based browser.")
      stopStreams()
    }
  }

  const stop = () => recorderRef.current?.state !== "inactive" && recorderRef.current?.stop()

  if (!supported) {
    return (
      <p className="rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-canvas)] p-6 text-center text-[14px] text-[var(--l-ink-subtle)]">
        Screen recording isn&apos;t supported in this browser. Try the latest Chrome, Edge, or Firefox on desktop.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Stage */}
      <div className="flex aspect-video w-full max-w-3xl items-center justify-center overflow-hidden rounded-3xl border border-[var(--l-hairline)] bg-[var(--l-canvas)]">
        {phase === "done" && url ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={url} controls className="h-full w-full bg-black" />
        ) : phase === "recording" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="relative flex size-4">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex size-4 rounded-full bg-red-500" />
            </span>
            <p className="font-mono text-2xl tabular-nums text-[var(--l-ink)]">{fmt(seconds)}</p>
            <p className="text-[13px] text-[var(--l-ink-subtle)]">Recording… switch to the tab or window you want to capture.</p>
          </div>
        ) : (
          <div className="px-6 text-center">
            <p className="text-[14px] text-[var(--l-ink-subtle)]">Your recording will appear here. Nothing is uploaded — it stays on your device.</p>
          </div>
        )}
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {phase !== "recording" ? (
          <>
            <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02]">
              <Circle className="size-4 fill-white" /> {phase === "done" ? "Record again" : "Start recording"}
            </button>
            <button
              type="button"
              onClick={() => setWithMic((v) => !v)}
              aria-pressed={withMic}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-medium transition-colors ${
                withMic ? "border-primary bg-primary/10 text-cobalt" : "border-[var(--l-hairline-strong)] bg-white text-[var(--l-ink)] hover:bg-[var(--l-hover)]"
              }`}
            >
              <Mic className="size-4" /> Microphone {withMic ? "on" : "off"}
            </button>
          </>
        ) : (
          <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02]">
            <Square className="size-4 fill-white" /> Stop
          </button>
        )}
        {phase === "done" && url && (
          <a href={url} download="tacto-recording.webm" className="inline-flex items-center gap-2 rounded-xl border border-[var(--l-hairline-strong)] bg-white px-5 py-2.5 text-[14px] font-semibold text-[var(--l-ink)] transition-colors hover:bg-[var(--l-hover)]">
            <Download className="size-4" /> Download .webm
          </a>
        )}
      </div>
    </div>
  )
}

function pickMime(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
  for (const c of candidates) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c
  return "video/webm"
}

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, "0")}`
}
