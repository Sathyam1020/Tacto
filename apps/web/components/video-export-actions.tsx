"use client"

import * as React from "react"
import { toast } from "sonner"

import { TRANSLATION_LANGUAGES } from "@workspace/contracts/guide"
import { BASE_LANGUAGE } from "@workspace/contracts/voice"

import { useGuideTranslations } from "@/lib/guides"
import {
  useGenerateVideo,
  useVideoExport,
  useVoiceoverLanguages,
} from "@/lib/video-export"

/** Human label for an export language code. */
export function exportLangLabel(code: string): string {
  return code === BASE_LANGUAGE
    ? "English"
    : (TRANSLATION_LANGUAGES.find((l) => l.code === code)?.name ?? code)
}

/**
 * Languages to offer for PDF: the base language plus every published
 * translation (the PDF renders the translated content, including non-Latin
 * scripts).
 */
export function usePdfLanguages(guideId: string): string[] {
  const { data: translations } = useGuideTranslations(guideId)
  return React.useMemo(
    () => [
      BASE_LANGUAGE,
      ...(translations ?? [])
        .filter((t) => t.published && t.status === "ready")
        .map((t) => t.language),
    ],
    [translations]
  )
}

/** A single "Download video" choice. */
export type VideoDownloadItem = {
  key: string
  label: string
  language: string
  silent: boolean
}

/**
 * Video download choices: one per language that has voiceover audio (so the
 * video actually has narration), plus a "Without voiceover" (silent) option.
 * Languages without voiceover are intentionally omitted.
 */
export function useVideoDownloadItems(guideId: string): VideoDownloadItem[] {
  const { data: voiceover } = useVoiceoverLanguages(guideId)
  return React.useMemo(() => {
    const items: VideoDownloadItem[] = (voiceover ?? []).map((code) => ({
      key: code,
      label: exportLangLabel(code),
      language: code,
      silent: false,
    }))
    items.push({
      key: "__novoice__",
      label: "Without voiceover",
      language: BASE_LANGUAGE,
      silent: true,
    })
    return items
  }, [voiceover])
}

function triggerDownload(url: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = "walkthrough.mp4"
  a.rel = "noopener"
  a.click()
}

/**
 * Headless controller: mount it (with a stable `key`) when the user asks to
 * download a video. It downloads immediately if the render is ready, otherwise
 * kicks off the worker render and downloads the moment it settles — then calls
 * `onDone`. Lives outside the menu so it survives the menu closing while the
 * worker renders.
 */
export function VideoAutoDownload({
  guideId,
  language,
  silent,
  onDone,
}: {
  guideId: string
  language: string
  silent: boolean
  onDone: () => void
}) {
  const { data: exp } = useVideoExport(guideId, language, silent)
  const generate = useGenerateVideo(guideId, language, silent)
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
