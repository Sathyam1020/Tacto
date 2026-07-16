"use client"

import * as React from "react"

/**
 * Posts embed lifecycle events to the framing parent so `embed.js` can
 * auto-resize and relay them (`Tacto.on(...)`). Active only inside an iframe.
 * Payloads are non-sensitive (heights, step indices), so `targetOrigin: "*"` is
 * fine; the SDK origin-checks the receiving side. Reuses the reader's existing
 * signals — the tracker's `tacto:track` DOM event and the step DOM markers — so
 * there's no duplicate step/complete detection.
 */
export function EmbedBridge({ shareId, mode }: { shareId: string; mode?: string }) {
  React.useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return
    const post = (type: string, payload?: Record<string, unknown>) => {
      try {
        window.parent.postMessage({ source: "tacto-embed", v: 1, type, payload: payload ?? {} }, "*")
      } catch {
        /* framing parent gone */
      }
    }

    post("READY", { shareId, mode })

    // Auto-resize: report the document height whenever it changes.
    let raf = 0
    const reportHeight = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        post("RESIZE", { height: Math.ceil(document.documentElement.getBoundingClientRect().height) })
      })
    }
    const ro = new ResizeObserver(reportHeight)
    ro.observe(document.documentElement)

    // Step change (list mode): the top-most visible step marker.
    let current = -1
    const stepEls = () => Array.from(document.querySelectorAll<HTMLElement>("[data-step-key]"))
    const io = new IntersectionObserver(
      (entries) => {
        const all = stepEls()
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => all.indexOf(e.target as HTMLElement))
          .filter((i) => i >= 0)
        if (!visible.length) return
        const idx = Math.min(...visible)
        if (idx !== current) {
          current = idx
          post("STEP_CHANGE", { index: idx, total: all.length })
        }
      },
      { threshold: 0.5 }
    )
    const observeSteps = () => stepEls().forEach((s) => io.observe(s))
    observeSteps()
    const t = window.setTimeout(observeSteps, 500) // steps may mount after a mode switch

    // Complete + interactive step come from the reader's tracker.
    const onTrack = (e: Event) => {
      const d = (e as CustomEvent).detail as { type?: string; context?: { stepIndex?: number } } | undefined
      if (d?.type === "complete") post("COMPLETE")
      else if (d?.type === "walkthrough_step" && typeof d.context?.stepIndex === "number")
        post("STEP_CHANGE", { index: d.context.stepIndex })
    }
    window.addEventListener("tacto:track", onTrack as EventListener)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      window.clearTimeout(t)
      window.removeEventListener("tacto:track", onTrack as EventListener)
    }
  }, [shareId, mode])

  return null
}
