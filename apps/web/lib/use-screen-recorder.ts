"use client"

import * as React from "react"
import { MAX_CAPTURE_DURATION_SEC } from "@workspace/contracts/capture"

/**
 * Screen recording via getDisplayMedia + MediaRecorder.
 *
 * State machine: idle → recording → stopped (blob ready) → idle.
 * Auto-stops at the product's 5-minute cap and when the user ends
 * sharing from the browser's own UI.
 */

export type RecorderState =
  | { status: "idle" }
  | { status: "recording"; elapsedSec: number }
  | { status: "stopped"; blob: Blob; mimeType: string; durationSec: number }

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4", // Safari
  ]
  return (
    candidates.find((type) => MediaRecorder.isTypeSupported(type)) ??
    "video/webm"
  )
}

export function useScreenRecorder() {
  const [state, setState] = React.useState<RecorderState>({ status: "idle" })
  const [error, setError] = React.useState<string | null>(null)

  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const streamsRef = React.useRef<MediaStream[]>([])
  const chunksRef = React.useRef<Blob[]>([])
  const startedAtRef = React.useRef(0)
  const tickRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = React.useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
    streamsRef.current.forEach((stream) =>
      stream.getTracks().forEach((track) => track.stop())
    )
    streamsRef.current = []
    recorderRef.current = null
  }, [])

  const stop = React.useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop() // onstop finalizes state
    }
  }, [])

  const start = React.useCallback(
    async ({ withMic }: { withMic: boolean }) => {
      setError(null)
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 15 },
          audio: false,
        })
        streamsRef.current.push(display)

        const tracks = [...display.getVideoTracks()]
        if (withMic) {
          const mic = await navigator.mediaDevices.getUserMedia({
            audio: true,
          })
          streamsRef.current.push(mic)
          tracks.push(...mic.getAudioTracks())
        }

        const mimeType = pickMimeType()
        const recorder = new MediaRecorder(new MediaStream(tracks), {
          mimeType,
          videoBitsPerSecond: 2_500_000,
        })
        recorderRef.current = recorder
        chunksRef.current = []
        startedAtRef.current = Date.now()

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data)
        }
        recorder.onstop = () => {
          const durationSec = (Date.now() - startedAtRef.current) / 1000
          const blob = new Blob(chunksRef.current, { type: mimeType })
          cleanup()
          if (blob.size === 0) {
            setError("Nothing was recorded")
            setState({ status: "idle" })
            return
          }
          setState({ status: "stopped", blob, mimeType, durationSec })
        }

        // User ended sharing from the browser UI → same as pressing stop.
        display.getVideoTracks()[0]?.addEventListener("ended", stop)

        recorder.start(1000) // gather chunks every second
        setState({ status: "recording", elapsedSec: 0 })

        tickRef.current = setInterval(() => {
          const elapsedSec = Math.floor(
            (Date.now() - startedAtRef.current) / 1000
          )
          setState((current) =>
            current.status === "recording"
              ? { status: "recording", elapsedSec }
              : current
          )
          if (elapsedSec >= MAX_CAPTURE_DURATION_SEC) stop()
        }, 1000)
      } catch (err) {
        cleanup()
        // User cancelled the picker → quiet return, not an error banner.
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setState({ status: "idle" })
          return
        }
        setError(
          err instanceof Error ? err.message : "Could not start recording"
        )
        setState({ status: "idle" })
      }
    },
    [cleanup, stop]
  )

  const reset = React.useCallback(() => {
    cleanup()
    setState({ status: "idle" })
    setError(null)
  }, [cleanup])

  React.useEffect(() => cleanup, [cleanup])

  return { state, error, start, stop, reset }
}
