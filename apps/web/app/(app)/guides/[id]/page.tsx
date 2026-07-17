"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  BarChart3,
  Download,
  FileDown,
  Info,
  MoreHorizontal,
  Share2,
} from "lucide-react"

import { SquarePenIcon } from "@workspace/ui/components/square-pen"

import { BASE_LANGUAGE } from "@workspace/contracts/voice"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import {
  GuideBody,
  ViewModeToggle,
  type ViewMode,
} from "@/components/guide-view"
import { GuideFaqs } from "@/components/guide-faqs"
import { useSetNavbar } from "@/components/navbar-context"
import { ShareDialog } from "@/components/share-dialog"
import {
  exportLangLabel,
  usePdfLanguages,
  useVideoDownloadItems,
  VideoAutoDownload,
  type VideoDownloadItem,
} from "@/components/video-export-actions"
import { authClient } from "@/lib/auth-client"
import { formatDate } from "@/lib/format"
import { layoutMaxWidthClass } from "@/components/guide-customization-context"
import { guideFontFamily } from "@/lib/guide-fonts"
import {
  resolveCustomization,
  useGuide,
  useGuideTranslations,
  usePublishDraft,
  type GuideTranslationFull,
} from "@/lib/guides"
import { useNarration } from "@/lib/narration"
import { cn } from "@workspace/ui/lib/utils"
import { downloadGuidePdf } from "@/lib/pdf"
import { toast } from "sonner"

/** Guide viewer — list/interactive modes + navbar action cluster. */
export default function GuidePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const {
    data: guide,
    isPending,
    isError,
  } = useGuide(activeWorkspace?.id, params.id)

  const [mode, setMode] = React.useState<ViewMode>("list")
  // Voiceover audio for the walkthrough preview (draft-aware, before publish).
  const { data: narration } = useNarration(params.id)
  const narrationAudio = React.useMemo(() => {
    const map: Record<string, { audioUrl: string }> = {}
    for (const it of narration?.items ?? []) {
      if (it.audioUrl) map[it.anchorKey] = { audioUrl: it.audioUrl }
    }
    return map
  }, [narration])
  const cust = React.useMemo(
    () => resolveCustomization(guide?.customization ?? null),
    [guide?.customization]
  )
  const dv = cust.general.defaultView
  const lockedMode: ViewMode | null =
    dv === "only-scroll" ? "list" : dv === "only-walkthrough" ? "interactive" : null
  const effectiveMode = lockedMode ?? mode
  // Apply the default view once the guide loads.
  const inited = React.useRef(false)
  React.useEffect(() => {
    if (guide && !inited.current) {
      inited.current = true
      setMode(
        dv === "walkthrough-default" || dv === "only-walkthrough"
          ? "interactive"
          : "list"
      )
    }
  }, [guide, dv])
  const [shareOpen, setShareOpen] = React.useState(false)
  const publishDraft = usePublishDraft(params.id)
  const [infoOpen, setInfoOpen] = React.useState(false)
  // The video currently being downloaded (null = none).
  const [videoReq, setVideoReq] = React.useState<VideoDownloadItem | null>(null)
  const clearVideoReq = React.useCallback(() => setVideoReq(null), [])
  const { data: translations } = useGuideTranslations(params.id)
  // Video: languages with voiceover + a "no voiceover" option. PDF: base +
  // every published translation (PDF renders the translated content).
  const videoItems = useVideoDownloadItems(params.id)
  const pdfLanguages = usePdfLanguages(params.id)
  // Build the PDF for a language, swapping in translated content when needed.
  const downloadPdf = React.useCallback(
    (language: string) => {
      if (!guide) return
      const t =
        language === BASE_LANGUAGE
          ? null
          : translations?.find((x) => x.language === language)
      void toast.promise(downloadGuidePdf(t ? translateGuide(guide, t) : guide), {
        loading: "Preparing PDF…",
        success: "PDF downloaded",
        error: "Couldn't create the PDF",
      })
    },
    [guide, translations]
  )

  useSetNavbar(
    {
      title: guide?.title ?? "Guide",
      // Primary back button at the leftmost, then the guide title.
      leftActions: guide ? (
        <div className="flex min-w-0 items-center gap-2.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-sm"
                  aria-label="Back to library"
                  onClick={() => router.push("/home")}
                />
              }
            >
              <ArrowLeft className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Back</TooltipContent>
          </Tooltip>
          <span className="truncate text-sm font-medium">{guide.title}</span>
        </div>
      ) : null,
      actions: guide ? (
        <div className="flex items-center gap-2">
          {!lockedMode && <ViewModeToggle mode={mode} onChange={setMode} />}
          <GuideActionsMenu
            videoItems={videoItems}
            pdfLanguages={pdfLanguages}
            busyVideoKey={videoReq?.key ?? null}
            onDownloadPdf={downloadPdf}
            onDownloadVideo={setVideoReq}
            onAnalytics={() => router.push(`/guides/${params.id}/analytics`)}
            onInfo={() => setInfoOpen(true)}
          />
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/guides/${params.id}/edit`} />}
          >
            <SquarePenIcon size={15} />
            Edit
          </Button>
          <Button size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="size-3.5" />
            Share
          </Button>
        </div>
      ) : null,
    },
    [
      guide?.title,
      guide?.status,
      mode,
      lockedMode,
      params.id,
      videoItems,
      pdfLanguages,
      videoReq,
      downloadPdf,
    ]
  )

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="mt-6 h-10 w-3/4" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-12 h-24 w-full" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
    )
  }

  if (isError || !guide) {
    return (
      <div className="mx-auto max-w-2xl pt-20 text-center">
        <p className="font-serif text-2xl">This guide doesn&apos;t exist.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been deleted, or it belongs to another workspace.
        </p>
        <Link
          href="/home"
          className="mt-6 inline-block text-sm text-viridian hover:underline"
        >
          Back to home
        </Link>
      </div>
    )
  }

  const stepCount = guide.blocks.filter((b) => b.type === "STEP").length

  return (
    <div
      className={cn("mx-auto", layoutMaxWidthClass(cust.general.pageLayout))}
      dir={cust.brand.rtl ? "rtl" : undefined}
      style={
        {
          ["--primary" as string]: cust.brand.color,
          fontFamily: guideFontFamily(cust.brand.font),
        } as React.CSSProperties
      }
    >
      {guide.hasUnpublishedChanges && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          <SquarePenIcon size={15} />
          <span className="flex-1 font-medium">You have unpublished changes.</span>
          <Link
            href={`/guides/${params.id}/edit`}
            className="font-medium text-amber-700/90 underline-offset-2 hover:underline dark:text-amber-400/90"
          >
            Continue editing
          </Link>
          <Button
            size="sm"
            disabled={publishDraft.isPending}
            onClick={() =>
              publishDraft.mutate(undefined, {
                onSuccess: () => toast.success("Changes published"),
                onError: () => toast.error("Couldn't publish changes"),
              })
            }
          >
            {publishDraft.isPending ? "Publishing…" : "Publish changes"}
          </Button>
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-4xl leading-tight font-medium tracking-tight text-balance">
          {guide.title}
        </h1>
        <Badge
          variant="secondary"
          className="mt-2 shrink-0 font-mono text-[10px]"
        >
          {guide.status.toLowerCase()}
        </Badge>
      </div>
      {guide.summary && (
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {guide.summary}
        </p>
      )}
      {guide.captureSource === "VIDEO_UPLOAD" && (
        <p className="mt-4 rounded-lg border px-4 py-3 text-sm text-muted-foreground">
          Draft — generated from your recording. Review the steps before
          sharing.
        </p>
      )}
      <p className="mt-4 border-b pb-6 font-mono text-xs text-muted-foreground">
        {stepCount} steps · captured {formatDate(guide.createdAt)}
      </p>

      <div className="mt-10">
        <GuideBody
          blocks={guide.blocks}
          interactive={guide.interactive}
          narration={narrationAudio}
          mode={effectiveMode}
          customization={cust}
        />
      </div>

      <GuideFaqs faqs={guide.faqs} />

      <div className="mt-16 border-t pt-6 font-mono text-xs text-muted-foreground">
        captured by hand · written by machine
      </div>

      {videoReq && (
        <VideoAutoDownload
          key={videoReq.key}
          guideId={params.id}
          language={videoReq.language}
          silent={videoReq.silent}
          onDone={clearVideoReq}
        />
      )}

      <ShareDialog guide={guide} open={shareOpen} onOpenChange={setShareOpen} />

      {/* Info */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium tracking-tight">
              Guide details
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <Row label="Title" value={guide.title} />
            <Row label="Blocks" value={String(guide.blocks.length)} />
            <Row label="Created" value={formatDate(guide.createdAt)} />
            <Row
              label="Source"
              value={
                guide.captureSource === "VIDEO_UPLOAD"
                  ? "Screen recording"
                  : guide.captureSource === "EXTENSION"
                    ? "Extension"
                    : "Import"
              }
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Overflow menu for the guide's secondary actions — downloads + details. */
function GuideActionsMenu({
  videoItems,
  pdfLanguages,
  busyVideoKey,
  onDownloadPdf,
  onDownloadVideo,
  onAnalytics,
  onInfo,
}: {
  videoItems: VideoDownloadItem[]
  pdfLanguages: string[]
  busyVideoKey: string | null
  onDownloadPdf: (language: string) => void
  onDownloadVideo: (item: VideoDownloadItem) => void
  onAnalytics: () => void
  onInfo: () => void
}) {
  const onlyVideo = videoItems[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon-sm" variant="outline" aria-label="More actions" />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {videoItems.length > 1 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Download className="size-4" />
              Download video
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {videoItems.map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  disabled={busyVideoKey === item.key}
                  onClick={() => onDownloadVideo(item)}
                >
                  {item.label}
                  {busyVideoKey === item.key && " — preparing…"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          onlyVideo && (
            <DropdownMenuItem
              disabled={busyVideoKey === onlyVideo.key}
              onClick={() => onDownloadVideo(onlyVideo)}
            >
              <Download className="size-4" />
              {busyVideoKey === onlyVideo.key
                ? "Preparing video…"
                : "Download video"}
            </DropdownMenuItem>
          )
        )}
        {pdfLanguages.length > 1 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileDown className="size-4" />
              Download PDF
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {pdfLanguages.map((code) => (
                <DropdownMenuItem key={code} onClick={() => onDownloadPdf(code)}>
                  {exportLangLabel(code)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <DropdownMenuItem onClick={() => onDownloadPdf(BASE_LANGUAGE)}>
            <FileDown className="size-4" />
            Download PDF
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAnalytics}>
          <BarChart3 className="size-4" />
          Analytics
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onInfo}>
          <Info className="size-4" />
          Guide info
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Overlay a translation onto the guide (title/summary/block content by key),
 *  so the PDF export renders in the chosen language. */
function translateGuide<
  G extends {
    title: string
    summary?: string | null
    blocks: { key: string; content: string }[]
  },
>(guide: G, t: GuideTranslationFull): G {
  return {
    ...guide,
    title: t.title || guide.title,
    summary: t.summary ?? guide.summary,
    blocks: guide.blocks.map((b) => ({
      ...b,
      content: t.steps[b.key] ?? b.content,
    })),
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
