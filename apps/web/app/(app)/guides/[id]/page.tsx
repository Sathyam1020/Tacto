"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, BarChart3, Info, Share2 } from "lucide-react"

import { DownloadIcon } from "@workspace/ui/components/download"
import { SquarePenIcon } from "@workspace/ui/components/square-pen"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
import { useSetNavbar } from "@/components/navbar-context"
import { ShareDialog } from "@/components/share-dialog"
import { authClient } from "@/lib/auth-client"
import { formatDate } from "@/lib/format"
import { layoutMaxWidthClass } from "@/components/guide-customization-context"
import { guideFontFamily } from "@/lib/guide-fonts"
import { resolveCustomization, useGuide } from "@/lib/guides"
import { useNarration } from "@/lib/narration"
import { cn } from "@workspace/ui/lib/utils"
import { downloadGuidePdf } from "@/lib/pdf"

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
  const [analyticsOpen, setAnalyticsOpen] = React.useState(false)
  const [infoOpen, setInfoOpen] = React.useState(false)

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
          {!lockedMode && (
            <ViewModeToggle mode={mode} onChange={setMode} />
          )}
          <IconButton label="Analytics" onClick={() => setAnalyticsOpen(true)}>
            <BarChart3 className="size-4" />
          </IconButton>
          <IconButton label="Guide info" onClick={() => setInfoOpen(true)}>
            <Info className="size-4" />
          </IconButton>
          <IconButton
            label="Download PDF"
            onClick={() => guide && void downloadGuidePdf(guide)}
          >
            <DownloadIcon size={16} />
          </IconButton>
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
    [guide?.title, guide?.status, mode, lockedMode, params.id]
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
        <Link
          href={`/guides/${params.id}/edit`}
          className="mb-6 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-400"
        >
          <SquarePenIcon size={15} />
          <span className="font-medium">You have unpublished changes.</span>
          <span className="text-amber-700/80 dark:text-amber-400/80">
            Continue editing →
          </span>
        </Link>
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

      <div className="mt-16 border-t pt-6 font-mono text-xs text-muted-foreground">
        captured by hand · written by machine
      </div>

      <ShareDialog guide={guide} open={shareOpen} onOpenChange={setShareOpen} />

      {/* Analytics */}
      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium tracking-tight">
              Analytics
            </DialogTitle>
            <DialogDescription>How this guide is performing.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <Row label="Views" value={String(guide.viewCount)} />
            <Row
              label="Status"
              value={guide.status === "PUBLISHED" ? "Published" : "Draft"}
            />
            <Row label="Steps" value={String(stepCount)} />
            {guide.publishedAt && (
              <Row label="Published" value={formatDate(guide.publishedAt)} />
            )}
          </div>
        </DialogContent>
      </Dialog>

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

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button size="icon-sm" variant="outline" aria-label={label} />}
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
