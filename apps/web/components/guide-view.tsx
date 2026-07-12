"use client"

import * as React from "react"

import type { GuideCustomization } from "@workspace/contracts/guide"
import { cn } from "@workspace/ui/lib/utils"

import { BlockView, withStepNumbers } from "@/components/block-view"
import { GuideCustomizationProvider } from "@/components/guide-customization-context"
import { InteractiveView } from "@/components/interactive-view"
import type { GuideBlock } from "@/lib/guides"

export type ViewMode = "list" | "interactive"

/** Renders a guide's body in the chosen mode. Shared by private + public.
 *  Provides the resolved customization to the renderers (hotspot, walkthrough
 *  toggles, image scaling). */
export function GuideBody({
  blocks,
  mode,
  customization,
}: {
  blocks: GuideBlock[]
  mode: ViewMode
  customization: GuideCustomization
}) {
  const numbered = withStepNumbers(blocks)
  const listRef = React.useRef<HTMLDivElement>(null)
  const stepTotal = numbered.filter((b) => b.type === "STEP").length
  // The List nav bar only applies to the narrower layouts (matches the modal).
  const navBarOn =
    customization.scrollView.navigationBar &&
    (customization.general.pageLayout === "extremely-narrow" ||
      customization.general.pageLayout === "narrow" ||
      customization.general.pageLayout === "moderate")

  return (
    <GuideCustomizationProvider value={customization}>
      {mode === "interactive" ? (
        <InteractiveView blocks={blocks} />
      ) : (
        <>
          {navBarOn && stepTotal > 0 && (
            <ListNavBar containerRef={listRef} total={stepTotal} />
          )}
          <div ref={listRef} className="flex flex-col gap-8">
            {numbered.map((block, i) => (
              <BlockView
                key={block.id}
                block={block}
                stepNumber={block.stepNumber}
                // Thread the spine only between back-to-back steps.
                connect={
                  block.type === "STEP" && numbered[i + 1]?.type === "STEP"
                }
              />
            ))}
          </div>
        </>
      )}
    </GuideCustomizationProvider>
  )
}

/**
 * A slim sticky progress bar for the List view — shows the current step and a
 * fill tracking scroll through the guide. Uses a capture-phase scroll listener
 * so it works whether the window or an inner shell element is the scroller.
 */
function ListNavBar({
  containerRef,
  total,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  total: number
}) {
  const [active, setActive] = React.useState(1)
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function update() {
      const rect = el!.getBoundingClientRect()
      const anchor = window.innerHeight * 0.4
      const frac = Math.min(
        1,
        Math.max(0, (anchor - rect.top) / Math.max(1, rect.height))
      )
      setProgress(frac)
      setActive(Math.min(total, Math.max(1, Math.ceil(frac * total) || 1)))
    }
    update()
    document.addEventListener("scroll", update, { passive: true, capture: true })
    window.addEventListener("resize", update)
    return () => {
      document.removeEventListener("scroll", update, { capture: true })
      window.removeEventListener("resize", update)
    }
  }, [containerRef, total])

  return (
    <div className="bg-card/70 supports-[backdrop-filter]:bg-card/50 sticky top-2 z-30 mb-6 flex items-center gap-3 rounded-full border px-4 py-2 backdrop-blur">
      <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
        Step {active} / {total}
      </span>
      <div className="bg-muted relative h-1 flex-1 overflow-hidden rounded-full">
        <div
          className="bg-primary absolute inset-y-0 left-0 rounded-full transition-[width] duration-200"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
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
