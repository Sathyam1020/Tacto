"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { StepMarker } from "@workspace/ui/components/step-marker"

import { RichText } from "@/components/rich-text"
import type { GuideBlock } from "@/lib/guides"

/**
 * Interactive walkthrough — one step at a time, big screenshot + instruction,
 * next/prev with arrow keys. Only STEP blocks participate (annotations are a
 * list-view concept). Viewing only; hotspot editing comes later.
 */
export function InteractiveView({ blocks }: { blocks: GuideBlock[] }) {
  const steps = React.useMemo(
    () => blocks.filter((b) => b.type === "STEP"),
    [blocks]
  )
  const [index, setIndex] = React.useState(0)

  const go = React.useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(Math.max(i + delta, 0), steps.length - 1))
    },
    [steps.length]
  )

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1)
      if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go])

  if (steps.length === 0) {
    return (
      <p className="text-muted-foreground py-24 text-center font-serif text-lg">
        This guide has no steps to walk through yet.
      </p>
    )
  }

  const step = steps[index]!
  const atStart = index === 0
  const atEnd = index === steps.length - 1

  return (
    <div className="flex flex-col items-center">
      {/* Progress dots */}
      <div className="mb-6 flex flex-wrap justify-center gap-1.5">
        {steps.map((s, i) => (
          <button
            key={s.id}
            aria-label={`Go to step ${i + 1}`}
            onClick={() => setIndex(i)}
            className={
              i === index
                ? "bg-viridian h-1.5 w-6 rounded-full transition-all"
                : "bg-border hover:bg-muted-foreground/40 h-1.5 w-1.5 rounded-full transition-all"
            }
          />
        ))}
      </div>

      {/* Screenshot */}
      {step.screenshotUrl ? (
        <div className="w-full overflow-hidden rounded-xl border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={step.screenshotUrl} alt="" className="w-full" />
        </div>
      ) : (
        <div className="bg-muted flex aspect-[16/9] w-full items-center justify-center rounded-xl border">
          <span className="text-muted-foreground text-sm">No screenshot</span>
        </div>
      )}

      {/* Instruction */}
      <div className="mt-6 flex w-full items-start gap-4">
        <StepMarker step={index + 1} size="lg" state="current" className="mt-0.5" />
        <RichText html={step.content} className="flex-1 text-[17px]" />
      </div>

      {/* Controls */}
      <div className="mt-8 flex w-full items-center justify-between">
        <Button variant="outline" onClick={() => go(-1)} disabled={atStart}>
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {index + 1} / {steps.length}
        </span>
        <Button onClick={() => go(1)} disabled={atEnd}>
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
