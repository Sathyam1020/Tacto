"use client"

import * as React from "react"

import type { HelpCenterEventType } from "@workspace/contracts/help-center"

import { readAnonId } from "@/lib/anon-id"

/**
 * Anonymous help-center engagement tracker. Site-wide shell events only —
 * homepage visits, searches, collection opens, contact clicks (article reads
 * keep flowing through the guide tracker). Mirrors the guide tracker's
 * best-effort beacon batching, minus session duration (the shell has no single
 * "reading session" to time).
 *
 * Dedup is centralized so callers fire freely: `view` / `contact_click` once
 * per visit, each `collection_open` (by slug) once, each `search` (by query)
 * once.
 */

type HelpEvent = {
  type: HelpCenterEventType
  target?: string
  zeroResults?: boolean
}

export type HelpTracker = {
  track: (type: HelpCenterEventType, opts?: { target?: string; zeroResults?: boolean }) => void
}

const NOOP: HelpTracker = { track: () => {} }
const HelpTrackerContext = React.createContext<HelpTracker>(NOOP)

/** Consume the ambient help tracker (no-op outside a provider). */
export function useHelpTracker(): HelpTracker {
  return React.useContext(HelpTrackerContext)
}

export function HelpTrackerProvider({
  slug,
  children,
}: {
  slug: string
  children: React.ReactNode
}) {
  const tracker = useHelpTrackerInstance(slug)
  return <HelpTrackerContext.Provider value={tracker}>{children}</HelpTrackerContext.Provider>
}

function useHelpTrackerInstance(slug: string): HelpTracker {
  const queue = React.useRef<HelpEvent[]>([])
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
    const url = `/api/public/help/${encodeURIComponent(slug)}/events`
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

  const track = React.useCallback<HelpTracker["track"]>(
    (type, opts) => {
      if (!session.current) return
      const key = `${type}|${opts?.target ?? ""}`
      if (seen.current.has(key)) return
      seen.current.add(key)
      queue.current.push({ type, ...opts })
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

  return React.useMemo(() => ({ track }), [track])
}
