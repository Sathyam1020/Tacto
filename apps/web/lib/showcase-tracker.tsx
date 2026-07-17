"use client"

import * as React from "react"

import type { ShowcaseEventType } from "@workspace/contracts/showcase"

import { readAnonId } from "@/lib/anon-id"

/**
 * Anonymous showcase engagement tracker. Showcase-level events only — the
 * per-guide reads inside a showcase keep flowing through the guide tracker
 * (tagged `source="showcase:{slug}"`). Mirrors the help-center tracker's
 * best-effort beacon batching + centralized dedup, so callers fire freely:
 * `view` / `complete` once per visit, each `item_open` / `item_complete`
 * (by item id) once.
 *
 * Every tracked event is also re-dispatched as a `tacto:showcase` DOM event so
 * the embed bridge can relay it to a framing parent (`Tacto.on(...)`).
 */

export type ShowcaseTracker = {
  track: (type: ShowcaseEventType, target?: string) => void
}

const NOOP: ShowcaseTracker = { track: () => {} }

export function useShowcaseTracker(slug: string): ShowcaseTracker {
  const queue = React.useRef<{ type: ShowcaseEventType; target?: string }[]>([])
  const seen = React.useRef<Set<string>>(new Set())
  const session = React.useRef<string>("")
  const anon = React.useRef<string | null>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const flush = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = undefined
    }
    const events = queue.current
    if (events.length === 0 || !session.current) return
    queue.current = []
    const body = JSON.stringify({ anonId: anon.current, sessionId: session.current, events })
    const url = `/api/public/showcase/${encodeURIComponent(slug)}/events`
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))
      } else {
        void fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {})
      }
    } catch {
      /* best-effort */
    }
  }, [slug])

  const track = React.useCallback<ShowcaseTracker["track"]>(
    (type, target) => {
      if (!session.current) return
      const key = `${type}|${target ?? ""}`
      if (seen.current.has(key)) return
      seen.current.add(key)
      queue.current.push(target ? { type, target } : { type })
      // Relay to a framing parent (embed) via the reader's DOM-event channel.
      try {
        window.dispatchEvent(new CustomEvent("tacto:showcase", { detail: { type, target } }))
      } catch {
        /* non-DOM env */
      }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 1500)
    },
    [flush]
  )

  React.useEffect(() => {
    session.current = crypto.randomUUID()
    anon.current = readAnonId()
    const onHide = () => flush()
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", onHide)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("pagehide", onHide)
      document.removeEventListener("visibilitychange", onVisibility)
      flush()
    }
  }, [flush])

  return React.useMemo(() => (slug ? { track } : NOOP), [slug, track])
}
