"use client"

import * as React from "react"

/**
 * Posts showcase embed lifecycle events to the framing parent so `embed.js` can
 * auto-resize and relay them (`Tacto.on(...)`). Active only inside an iframe.
 * Reuses the tracker's `tacto:showcase` DOM event, so there's no duplicate
 * open/complete detection. Payloads are non-sensitive (heights, item ids), so
 * `targetOrigin: "*"` is fine — the SDK origin-checks the receiving side.
 */
export function ShowcaseEmbedBridge({ slug }: { slug: string }) {
  React.useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return
    const post = (type: string, payload?: Record<string, unknown>) => {
      try {
        window.parent.postMessage({ source: "tacto-embed", v: 1, type, payload: payload ?? {} }, "*")
      } catch {
        /* framing parent gone */
      }
    }

    post("READY", { slug })

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

    // Showcase-level engagement, relayed from the tracker.
    const onShowcase = (e: Event) => {
      const d = (e as CustomEvent).detail as { type?: string; target?: string } | undefined
      if (!d?.type) return
      post(d.type.toUpperCase(), d.target ? { itemId: d.target } : {})
    }
    window.addEventListener("tacto:showcase", onShowcase as EventListener)

    // Surface uncaught errors so the host can react (Tacto.on("error", …)).
    const onError = (ev: ErrorEvent) => post("ERROR", { message: String(ev.message || "error").slice(0, 200) })
    window.addEventListener("error", onError)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener("tacto:showcase", onShowcase as EventListener)
      window.removeEventListener("error", onError)
    }
  }, [slug])

  return null
}
