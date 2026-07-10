"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { BarChart3, Download, Info, Pencil, Share2 } from "lucide-react"

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

import { GuideBody, ViewModeToggle, type ViewMode } from "@/components/guide-view"
import { useSetNavbar } from "@/components/navbar-context"
import { ShareDialog } from "@/components/share-dialog"
import { authClient } from "@/lib/auth-client"
import { formatDate } from "@/lib/format"
import { useGuide } from "@/lib/guides"
import { downloadGuidePdf } from "@/lib/pdf"

/** Guide viewer — list/interactive modes + navbar action cluster. */
export default function GuidePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: guide, isPending, isError } = useGuide(
    activeWorkspace?.id,
    params.id
  )

  const [mode, setMode] = React.useState<ViewMode>("list")
  const [shareOpen, setShareOpen] = React.useState(false)
  const [analyticsOpen, setAnalyticsOpen] = React.useState(false)
  const [infoOpen, setInfoOpen] = React.useState(false)

  useSetNavbar(
    {
      title: guide?.title ?? "Guide",
      actions: guide ? (
        <div className="flex items-center gap-2">
          <ViewModeToggle mode={mode} onChange={setMode} />
          <IconButton
            label="Analytics"
            onClick={() => setAnalyticsOpen(true)}
          >
            <BarChart3 className="size-4" />
          </IconButton>
          <IconButton label="Guide info" onClick={() => setInfoOpen(true)}>
            <Info className="size-4" />
          </IconButton>
          <IconButton
            label="Download PDF"
            onClick={() => guide && void downloadGuidePdf(guide)}
          >
            <Download className="size-4" />
          </IconButton>
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/guides/${params.id}/edit`} />}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="size-3.5" />
            Share
          </Button>
        </div>
      ) : null,
    },
    [guide?.title, guide?.status, mode, params.id]
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
        <p className="text-muted-foreground mt-2 text-sm">
          It may have been deleted, or it belongs to another workspace.
        </p>
        <Link
          href="/home"
          className="text-viridian mt-6 inline-block text-sm hover:underline"
        >
          Back to home
        </Link>
      </div>
    )
  }

  const stepCount = guide.blocks.filter((b) => b.type === "STEP").length

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight text-balance">
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
        <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
          {guide.summary}
        </p>
      )}
      {guide.captureSource === "VIDEO_UPLOAD" && (
        <p className="text-muted-foreground mt-4 rounded-lg border px-4 py-3 text-sm">
          Draft — generated from your recording. Review the steps before
          sharing.
        </p>
      )}
      <p className="text-muted-foreground mt-4 border-b pb-6 font-mono text-xs">
        {stepCount} steps · captured {formatDate(guide.createdAt)}
      </p>

      <div className="mt-10">
        <GuideBody blocks={guide.blocks} mode={mode} />
      </div>

      <div className="text-muted-foreground mt-16 border-t pt-6 font-mono text-xs">
        captured by hand · written by machine
      </div>

      <ShareDialog
        guide={guide}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />

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
              <Row
                label="Published"
                value={formatDate(guide.publishedAt)}
              />
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
        render={
          <Button size="icon-sm" variant="outline" aria-label={label} />
        }
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
