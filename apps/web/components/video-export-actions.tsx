"use client"

import * as React from "react"
import { toast } from "sonner"

import { TRANSLATION_LANGUAGES } from "@workspace/contracts/guide"
import { BASE_LANGUAGE } from "@workspace/contracts/voice"

import { useGenerateVideo, useVideoExport } from "@/lib/video-export"

/** Human label for an export language code. */
export function exportLangLabel(code: string): string {
  return code === BASE_LANGUAGE
    ? "English"
    : (TRANSLATION_LANGUAGES.find((l) => l.code === code)?.name ?? code)
}

function triggerDownload(url: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = "walkthrough.mp4"
  a.rel = "noopener"
  a.click()
}

/**
 * Headless controller: mount it (with a stable `key={language}`) when the user
 * asks to download a language's video. It downloads immediately if the render
 * is ready, otherwise kicks off the worker render and downloads the moment it
 * settles — then calls `onDone`. It lives outside the menu so it survives the
 * menu closing while the worker renders.
 */
export function VideoAutoDownload({
  guideId,
  language,
  onDone,
}: {
  guideId: string
  language: string
  onDone: () => void
}) {
  const { data: exp } = useVideoExport(guideId, language)
  const generate = useGenerateVideo(guideId, language)
  const phase = React.useRef<"init" | "waiting" | "done">("init")

  React.useEffect(() => {
    if (!exp || phase.current === "done") return
    const ready = exp.status === "ready" && !!exp.url && !exp.stale

    if (phase.current === "init") {
      if (ready) {
        phase.current = "done"
        triggerDownload(exp.url!)
        toast.success("Video downloaded")
        onDone()
        return
      }
      phase.current = "waiting"
      // Already rendering → just wait; otherwise start it.
      if (exp.status !== "generating") {
        toast.info("Preparing your video — it'll download automatically.")
        generate.mutate(undefined, {
          onError: () => {
            phase.current = "done"
            toast.error("Couldn't start the video")
            onDone()
          },
        })
      }
      return
    }

    // waiting → settle
    if (ready) {
      phase.current = "done"
      triggerDownload(exp.url!)
      toast.success("Video downloaded")
      onDone()
    } else if (exp.status === "failed") {
      phase.current = "done"
      toast.error("Couldn't render the video")
      onDone()
    }
  }, [exp, generate, onDone])

  return null
}
