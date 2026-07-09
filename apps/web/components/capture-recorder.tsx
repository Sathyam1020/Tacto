"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import axios from "axios"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { TouchRing } from "@workspace/ui/components/touch-ring"

import { api } from "@/lib/api"
import { useScreenRecorder } from "@/lib/use-screen-recorder"

/**
 * The Capture flow, in the navbar:
 *  idle    → [Capture] button → setup dialog (mic toggle) → screen picker
 *  recording → signal-red pulse + mono timer + Stop
 *  stopped → title dialog → upload to R2 (progress) → complete → processing
 */

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function CaptureRecorder() {
  const queryClient = useQueryClient()
  const { state, error: recorderError, start, stop, reset } =
    useScreenRecorder()

  const [setupOpen, setSetupOpen] = React.useState(false)
  const [withMic, setWithMic] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [uploadPct, setUploadPct] = React.useState<number | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  async function handleBegin() {
    setSetupOpen(false)
    await start({ withMic })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (state.status !== "stopped") return
    setSubmitError(null)
    setUploadPct(0)

    try {
      // 1. Create the capture + get the presigned upload URL.
      const { data: created } = await api.post<{
        capture: { id: string }
        uploadUrl: string
      }>("/captures/video", {
        title: title.trim() || undefined,
        mimeType: state.mimeType,
      })

      // 2. PUT the recording straight to R2 (not through our API).
      await axios.put(created.uploadUrl, state.blob, {
        headers: { "Content-Type": state.mimeType },
        onUploadProgress: (progress) => {
          if (progress.total) {
            setUploadPct(Math.round((progress.loaded / progress.total) * 100))
          }
        },
      })

      // 3. Mark complete → processing begins.
      await api.post(`/captures/${created.capture.id}/complete`)

      await queryClient.invalidateQueries({ queryKey: ["captures"] })
      setUploadPct(null)
      setTitle("")
      reset()
    } catch (err) {
      setUploadPct(null)
      setSubmitError(
        axios.isAxiosError(err)
          ? (err.response?.data?.error?.message ?? "Upload failed — try again")
          : "Upload failed — try again"
      )
    }
  }

  function handleDiscard() {
    setTitle("")
    setSubmitError(null)
    reset()
  }

  // ── Recording state: red pulse + timer + stop ──────────────────────────
  if (state.status === "recording") {
    return (
      <div className="flex items-center gap-3">
        <TouchRing variant="pulse" tone="recording" size="sm" label="Recording" />
        <span className="text-signal font-mono text-xs tabular-nums">
          {formatElapsed(state.elapsedSec)} / 5:00
        </span>
        <Button size="sm" variant="secondary" onClick={stop}>
          Stop
        </Button>
      </div>
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setSetupOpen(true)}>
        <TouchRing size="sm" tone="neutral" />
        Capture
      </Button>
      {recorderError && (
        <span className="text-signal text-xs">{recorderError}</span>
      )}

      {/* ── Setup dialog ──────────────────────────────────────────────── */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium tracking-tight">
              Capture a workflow
            </DialogTitle>
            <DialogDescription>
              Record your screen while you perform the task once — Tacto
              writes the guide. Up to 5 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="mic-toggle">Narrate with your microphone</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Explaining as you go makes the written steps much better.
              </p>
            </div>
            <Switch
              id="mic-toggle"
              checked={withMic}
              onCheckedChange={setWithMic}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSetupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBegin}>
              <TouchRing size="sm" tone="neutral" />
              Choose what to record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Title + upload dialog (recording finished) ────────────────── */}
      <Dialog
        open={state.status === "stopped"}
        onOpenChange={(open) => {
          if (!open && uploadPct === null) handleDiscard()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium tracking-tight">
              Name your capture
            </DialogTitle>
            <DialogDescription>
              {state.status === "stopped"
                ? `${Math.round(state.durationSec)}s recorded. Tacto will turn it into a draft guide.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="capture-title">Title</Label>
              <Input
                id="capture-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="How to issue a refund"
                autoFocus
              />
            </div>
            {submitError && (
              <p role="alert" className="text-signal text-sm">
                {submitError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={handleDiscard}
                disabled={uploadPct !== null}
              >
                Discard
              </Button>
              <Button type="submit" disabled={uploadPct !== null}>
                {uploadPct !== null
                  ? `Uploading… ${uploadPct}%`
                  : "Create guide"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
