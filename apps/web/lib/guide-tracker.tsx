"use client"

import * as React from "react"

import type {
  GuideEventContext,
  GuideEventType,
} from "@workspace/contracts/guide-analytics"

import { readAnonId } from "@/lib/anon-id"

/**
 * Anonymous reader-analytics tracker for a published guide. Batches events and
 * flushes them to the public `/events` beacon via `navigator.sendBeacon` (with a
 * `keepalive` fetch fallback) on a short debounce, on tab-hide, and on pagehide.
 * Everything is best-effort: failures never surface, and analytics stay correct
 * even if the final `session_end` flush is lost to an abrupt close.
 *
 * Dedup is centralized here so callers can fire freely: `view` / `complete` /
 * `session_end` once per session, each `walkthrough_step` (by stepIndex) once,
 * each language/mode/embed (by its discriminator) once.
 */

export type GuideTracker = {
  track: (type: GuideEventType, context?: GuideEventContext) => void
}

const NOOP: GuideTracker = { track: () => {} }
const GuideAnalyticsContext = React.createContext<GuideTracker>(NOOP)

/** Consume the ambient guide tracker. Returns a no-op tracker outside a
 *  provider (e.g. the editor preview) so instrumentation is inert there. */
export function useGuideAnalytics(): GuideTracker {
  return React.useContext(GuideAnalyticsContext)
}

export function GuideAnalyticsProvider({
  tracker,
  children,
}: {
  tracker: GuideTracker
  children: React.ReactNode
}) {
  return (
    <GuideAnalyticsContext.Provider value={tracker}>
      {children}
    </GuideAnalyticsContext.Provider>
  )
}

/** One-off, session-level attributes attached to the `view` event. */
function collectSessionContext(): GuideEventContext {
  const ctx: GuideEventContext = {}
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).host
      // Only count external referrers as a "source"; same-origin = direct.
      ctx.referrerHost = host && host !== location.host ? host : "direct"
    } else {
      ctx.referrerHost = "direct"
    }
  } catch {
    ctx.referrerHost = "direct"
  }
  ctx.deviceType = detectDeviceType()
  const browser = detectBrowser()
  if (browser) ctx.browser = browser
  try {
    const q = new URLSearchParams(location.search)
    const src = q.get("utm_source")
    const med = q.get("utm_medium")
    const cmp = q.get("utm_campaign")
    if (src) ctx.utmSource = src.slice(0, 128)
    if (med) ctx.utmMedium = med.slice(0, 128)
    if (cmp) ctx.utmCampaign = cmp.slice(0, 128)
  } catch {
    /* ignore */
  }
  return ctx
}

function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  const ua = navigator.userAgent
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) return "tablet"
  if (/Mobi|iPhone|Android/i.test(ua)) return "mobile"
  return "desktop"
}

function detectBrowser(): string | undefined {
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return "edge"
  if (/OPR\//.test(ua)) return "opera"
  if (/Firefox\//.test(ua)) return "firefox"
  if (/Chrome\//.test(ua)) return "chrome"
  if (/Safari\//.test(ua)) return "safari"
  return undefined
}

/** Discriminator so dedup fires per meaningful variant, not just per type. */
function dedupKey(type: GuideEventType, ctx?: GuideEventContext): string {
  const disc =
    ctx?.stepIndex ?? ctx?.language ?? ctx?.mode ?? ctx?.formId ?? ""
  return `${type}|${disc}`
}

export function useGuideTracker(shareId: string): GuideTracker {
  const queue = React.useRef<
    { type: GuideEventType; context?: GuideEventContext }[]
  >([])
  const seen = React.useRef<Set<string>>(new Set())
  const session = React.useRef<string>("")
  const anon = React.useRef<string | null>(null)
  const sessionCtx = React.useRef<GuideEventContext>({})
  const mountedAt = React.useRef<number>(0)
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const ended = React.useRef(false)

  const flush = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = undefined
    }
    const events = queue.current
    if (events.length === 0 || !session.current) return
    queue.current = []
    const body = JSON.stringify({
      anonId: anon.current,
      sessionId: session.current,
      events,
    })
    const url = `/api/public/guides/${shareId}/events`
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
  }, [shareId])

  const track = React.useCallback(
    (type: GuideEventType, context?: GuideEventContext) => {
      if (!session.current) return
      const key = dedupKey(type, context)
      if (seen.current.has(key)) return
      seen.current.add(key)
      const ctx = type === "view" ? { ...sessionCtx.current, ...context } : context
      queue.current.push(ctx && Object.keys(ctx).length ? { type, context: ctx } : { type })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 1500)
    },
    [flush]
  )

  React.useEffect(() => {
    session.current = crypto.randomUUID()
    anon.current = readAnonId()
    mountedAt.current = Date.now()
    sessionCtx.current = collectSessionContext()

    const end = () => {
      if (ended.current) return
      ended.current = true
      const durationMs = Date.now() - mountedAt.current
      // Bypass dedup guard for the single terminal event.
      queue.current.push({ type: "session_end", context: { durationMs } })
      flush()
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush() // ship whatever's queued while we still can
      }
    }
    window.addEventListener("pagehide", end)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("pagehide", end)
      document.removeEventListener("visibilitychange", onVisibility)
      end()
    }
  }, [flush])

  return React.useMemo(() => ({ track }), [track])
}
