"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

import { BlockView, withStepNumbers } from "@/components/block-view"
import { InteractiveView } from "@/components/interactive-view"
import type { GuideBlock } from "@/lib/guides"

export type ViewMode = "list" | "interactive"

/** Renders a guide's body in the chosen mode. Shared by private + public. */
export function GuideBody({
  blocks,
  mode,
}: {
  blocks: GuideBlock[]
  mode: ViewMode
}) {
  if (mode === "interactive") {
    return <InteractiveView blocks={blocks} />
  }
  const numbered = withStepNumbers(blocks)
  return (
    <div className="flex flex-col gap-8">
      {numbered.map((block) => (
        <BlockView key={block.id} block={block} stepNumber={block.stepNumber} />
      ))}
    </div>
  )
}

/** List / Interactive segmented toggle. */
export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  return (
    <div className="bg-muted inline-flex items-center rounded-lg p-0.5">
      {(["list", "interactive"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
            mode === m
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {m === "list" ? "List" : "Interactive"}
        </button>
      ))}
    </div>
  )
}
