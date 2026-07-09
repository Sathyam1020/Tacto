import type { BlockType } from "@workspace/contracts/guide"
import { Info, TriangleAlert } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { StepMarker } from "@workspace/ui/components/step-marker"

import { RichText } from "@/components/rich-text"

/** The fields BlockView needs — satisfied by both GuideBlock and EditBlock. */
type ViewableBlock = {
  type: BlockType
  content: string
  screenshotUrl: string | null
  url: string | null
  confidence: number | null
}

/**
 * Renders one guide block by type — the single source of truth for how
 * guides look in the private view, editor preview, and public page.
 *
 * `stepNumber` is supplied by the parent (only STEP blocks are numbered).
 */
export function BlockView({
  block,
  stepNumber,
}: {
  block: ViewableBlock
  stepNumber?: number
}) {
  switch (block.type) {
    case "HEADING":
      return (
        <RichText
          html={block.content}
          className="font-serif text-2xl font-medium tracking-tight [&_p]:font-serif [&_p]:text-2xl [&_p]:font-medium"
        />
      )

    case "TIP":
      return (
        <div className="border-viridian/20 bg-viridian/5 flex gap-3 rounded-xl border px-4 py-3">
          <span className="bg-viridian mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white">
            <Info className="size-3" />
          </span>
          <RichText html={block.content} className="text-viridian text-sm" />
        </div>
      )

    case "ALERT":
      return (
        <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
            <TriangleAlert className="size-3" />
          </span>
          <RichText
            html={block.content}
            className="text-sm text-amber-700 dark:text-amber-500"
          />
        </div>
      )

    case "STEP":
    default:
      return (
        <div className="flex gap-5">
          <StepMarker step={stepNumber ?? 1} size="lg" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <RichText html={block.content} className="text-[17px]" />
              {block.confidence !== null && block.confidence < 0.7 && (
                <Badge
                  variant="outline"
                  className="mt-1.5 shrink-0 font-mono text-[10px]"
                >
                  review
                </Badge>
              )}
            </div>
            {block.url && (
              <p className="text-muted-foreground mt-1.5 truncate font-mono text-xs">
                {block.url.replace(/^https?:\/\//, "")}
              </p>
            )}
            {block.screenshotUrl && (
              <div className="mt-4 overflow-hidden rounded-xl border">
                {/* Presigned URL, short-lived — plain img by design. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={block.screenshotUrl}
                  alt={`Screenshot for step ${stepNumber ?? ""}`}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      )
  }
}

/** Assign display step numbers: only STEP blocks count. */
export function withStepNumbers<T extends { type: BlockType }>(
  blocks: T[]
): (T & { stepNumber?: number })[] {
  let n = 0
  return blocks.map((block) => {
    if (block.type === "STEP") {
      n += 1
      return { ...block, stepNumber: n }
    }
    return { ...block, stepNumber: undefined }
  })
}
