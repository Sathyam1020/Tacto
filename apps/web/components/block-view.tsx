import type { BlockType } from "@workspace/contracts/guide"
import { Check, Info, TriangleAlert } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { StepMarker } from "@workspace/ui/components/step-marker"

import { RichText } from "@/components/rich-text"
import { ScreenshotFrame } from "@/components/screenshot-frame"
import type { ClickRect } from "@/lib/guides"

/** The fields BlockView needs — satisfied by both GuideBlock and EditBlock. */
type ViewableBlock = {
  /** Stable Step key — anchors form embeds ("after step") in the reader. */
  key?: string
  type: BlockType
  content: string
  screenshotUrl: string | null
  url: string | null
  clickRect?: ClickRect | null
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
  connect = false,
}: {
  block: ViewableBlock
  stepNumber?: number
  /** Draw the throughline spine down to the next step (set by GuideBody). */
  connect?: boolean
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
        <div className="border-sage/25 bg-sage-tint flex gap-3 rounded-xl border px-4 py-3">
          <span className="bg-sage mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white">
            <Info className="size-3" />
          </span>
          <RichText html={block.content} className="text-sage-ink text-sm" />
        </div>
      )

    case "ALERT":
      return (
        <div className="border-amber/25 bg-amber-tint flex gap-3 rounded-xl border px-4 py-3">
          <span className="bg-amber mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white">
            <TriangleAlert className="size-3" />
          </span>
          <RichText html={block.content} className="text-amber-ink text-sm" />
        </div>
      )

    case "OUTCOME":
      // Presentation-only confirmation of the final result — no number, no
      // pointer, distinct "you'll now see" treatment.
      return (
        <div className="flex gap-5">
          <div className="relative flex flex-col items-center">
            <span className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-[var(--l-success)]/15 text-[var(--l-success)] ring-1 ring-[var(--l-success)]/30">
              <Check className="size-4" strokeWidth={2.5} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              You'll now see
            </p>
            <RichText html={block.content} className="mt-1 text-[17px]" />
            {block.screenshotUrl && (
              <ScreenshotFrame
                src={block.screenshotUrl}
                clickRect={null}
                controls
                className="mt-4"
              />
            )}
          </div>
        </div>
      )

    case "STEP":
    default:
      return (
        <div className="flex gap-5" data-step-key={block.key}>
          <div className="relative flex flex-col items-center">
            <StepMarker step={stepNumber ?? 1} size="lg" className="mt-0.5" />
            {connect && (
              <span
                aria-hidden
                className="bg-line-2 mt-2 -mb-8 w-px flex-1"
              />
            )}
          </div>
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
              <ScreenshotFrame
                src={block.screenshotUrl}
                clickRect={block.clickRect}
                controls
                className="mt-4"
              />
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
