"use client"

import * as React from "react"
import { Check, ChevronDown, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { TRANSLATION_LANGUAGES } from "@workspace/contracts/guide"
import { BASE_LANGUAGE } from "@workspace/contracts/voice"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { useGuideTranslations } from "@/lib/guides"
import { useGenerateVideo, useVideoExport } from "@/lib/video-export"

function langLabel(code: string): string {
  return code === BASE_LANGUAGE
    ? "English"
    : (TRANSLATION_LANGUAGES.find((l) => l.code === code)?.name ?? code)
}

/**
 * "Download video" — renders (if needed) and downloads the walkthrough MP4. When
 * the guide has published translations, a language menu picks which language's
 * narration + captions to export; each language renders independently.
 */
export function VideoExportButton({
  guideId,
  size = "sm",
}: {
  guideId: string
  size?: "sm" | "default"
}) {
  const { data: translations } = useGuideTranslations(guideId)
  const [language, setLanguage] = React.useState(BASE_LANGUAGE)
  // Base language + any translation the reader can actually see.
  const languages = React.useMemo(
    () => [
      BASE_LANGUAGE,
      ...(translations ?? [])
        .filter((t) => t.published && t.status === "ready")
        .map((t) => t.language),
    ],
    [translations]
  )

  return (
    <div className="flex items-center gap-1.5">
      {languages.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size={size}>
                {langLabel(language)}
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {languages.map((code) => (
              <DropdownMenuItem key={code} onClick={() => setLanguage(code)}>
                <Check
                  className={
                    code === language ? "size-4" : "size-4 opacity-0"
                  }
                />
                {langLabel(code)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <DownloadAction
        key={language}
        guideId={guideId}
        language={language}
        size={size}
      />
    </div>
  )
}

/** The download button for a single language (its own render lifecycle). */
function DownloadAction({
  guideId,
  language,
  size,
}: {
  guideId: string
  language: string
  size: "sm" | "default"
}) {
  const { data: exp } = useVideoExport(guideId, language)
  const generate = useGenerateVideo(guideId, language)
  // The user clicked and is waiting for a fresh render to auto-download.
  const [waiting, setWaiting] = React.useState(false)

  const ready = exp?.status === "ready" && !!exp.url && !exp.stale

  const download = React.useCallback((url: string) => {
    const a = document.createElement("a")
    a.href = url
    a.download = "walkthrough.mp4"
    a.rel = "noopener"
    a.click()
  }, [])

  // Auto-download (or report failure) once the requested render settles.
  React.useEffect(() => {
    if (!waiting) return
    if (exp?.status === "ready" && exp.url && !exp.stale) {
      download(exp.url)
      setWaiting(false)
      toast.success("Video downloaded")
    } else if (exp?.status === "failed") {
      setWaiting(false)
      toast.error("Couldn't render the video")
    }
  }, [waiting, exp?.status, exp?.url, exp?.stale, download])

  function onClick() {
    if (ready && exp?.url) {
      download(exp.url)
      return
    }
    setWaiting(true)
    toast.info("Preparing your video — it'll download automatically.")
    generate.mutate(undefined, {
      onError: () => {
        setWaiting(false)
        toast.error("Couldn't start the video")
      },
    })
  }

  const busy = waiting || generate.isPending || exp?.status === "generating"

  return (
    <Button variant="outline" size={size} onClick={onClick} disabled={busy}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      {busy ? "Preparing video…" : "Download video"}
    </Button>
  )
}
