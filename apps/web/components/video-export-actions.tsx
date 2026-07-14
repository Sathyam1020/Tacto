"use client"

import * as React from "react"
import { toast } from "sonner"

import { TRANSLATION_LANGUAGES } from "@workspace/contracts/guide"
import { BASE_LANGUAGE } from "@workspace/contracts/voice"

import {
  useGuideTranslations,
  type GuideTranslationFull,
} from "@/lib/guides"
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

/** Published, ready translations for the guide (shared by both language lists). */
function usePublishedTranslations(guideId: string): GuideTranslationFull[] {
  const { data } = useGuideTranslations(guideId)
  return React.useMemo(
    () => (data ?? []).filter((t) => t.published && t.status === "ready"),
    [data]
  )
}

/**
 * Languages to offer for VIDEO: the base language (always — a silent video is
 * still valid) plus any translation that actually has voiceover audio, so we
 * never list a language whose video would be silent.
 */
export function useVideoLanguages(guideId: string): string[] {
  const translations = usePublishedTranslations(guideId)
  const { data: voiceover } = useVoiceoverLanguages(guideId)
  return React.useMemo(() => {
    const ready = new Set(voiceover ?? [])
    return [
      BASE_LANGUAGE,
      ...translations
        .filter((t) => ready.has(t.language))
        .map((t) => t.language),
    ]
  }, [translations, voiceover])
}

// Characters jsPDF's built-in (WinAnsi / CP1252) font can render beyond
// Latin-1 — smart quotes, dashes, etc. Anything else (CJK, Devanagari, Arabic,
// Cyrillic…) comes out as garbage, so we don't offer PDF for it.
const CP1252_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
])

function pdfRenderable(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c === 0x09 || c === 0x0a || c === 0x0d) continue // whitespace
    if (c >= 0x20 && c <= 0xff) continue // ASCII + Latin-1
    if (CP1252_EXTRA.has(c)) continue
    return false
  }
  return true
}

/**
 * Languages to offer for PDF: the base language plus any translation whose text
 * the built-in PDF font can actually render (Latin scripts). Non-Latin
 * translations are omitted — the video export covers them instead.
 */
export function usePdfLanguages(guideId: string): string[] {
  const translations = usePublishedTranslations(guideId)
  return React.useMemo(
    () => [
      BASE_LANGUAGE,
      ...translations
        .filter(
          (t) =>
            pdfRenderable(t.title) &&
            pdfRenderable(t.summary ?? "") &&
            Object.values(t.steps).every(pdfRenderable)
        )
        .map((t) => t.language),
    ],
    [translations]
  )
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
