import { posthog } from "posthog-js"

import type { AnalyticsContext } from "./context.js"
import type {
  AnalyticsEvent,
  AnalyticsEvents,
  UserTraits,
  WorkspaceTraits,
} from "./events.js"

// This entry is bundled by the web app (Turbopack), which — unlike tsx/Vite/tsc
// — does NOT remap NodeNext `.js` specifiers to `.ts`. So this file must have no
// runtime relative imports. The shared source of truth still lives in
// ./events.ts + ./context.ts (imported as TYPES here — those are erased at
// build — and as values by the server/extension entries). The two tiny runtime
// bits below are inlined to satisfy the bundler.
const WORKSPACE_GROUP = "workspace"
function contextProperties(platform: string, ctx: AnalyticsContext): Record<string, string> {
  const props: Record<string, string> = { platform }
  if (ctx.environment) props.environment = ctx.environment
  if (ctx.appVersion) props.app_version = ctx.appVersion
  if (ctx.buildSha) props.build_sha = ctx.buildSha
  return props
}

export type BrowserAnalyticsConfig = AnalyticsContext & {
  /** PostHog project token. When absent, every call is a no-op. */
  key?: string
  /** Reverse-proxy path the browser posts to, e.g. "/ingest". */
  apiHost?: string
  /** Public PostHog app host for links, e.g. https://us.posthog.com */
  uiHost?: string
  /** Start opted-out until consent is granted. Default true. */
  optOutByDefault?: boolean
}

// The posthog-js singleton lives here and only here — no page/component ever
// imports posthog-js directly.
let started = false
let live = false

/**
 * Initialize the browser client once. Idempotent, SSR-safe (no-ops off the
 * browser), and a no-op when `key` is absent. Autocapture is OFF by design — we
 * rely on explicit typed events + manual pageviews.
 */
export function initBrowserAnalytics(config: BrowserAnalyticsConfig): void {
  if (started || typeof window === "undefined") return
  started = true
  if (!config.key) return
  live = true

  posthog.init(config.key, {
    api_host: config.apiHost ?? "/ingest",
    ui_host: config.uiHost,
    defaults: "2025-05-24",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    opt_out_capturing_by_default: config.optOutByDefault ?? true,
  })
  posthog.register(contextProperties("web", config))
}

/** Manual pageview — App Router client nav doesn't auto-fire one. */
export function capturePageview(): void {
  if (live) posthog.capture("$pageview")
}

/** Fire a typed event. Invalid names/props fail to compile. */
export function capture<K extends AnalyticsEvent>(event: K, properties: AnalyticsEvents[K]): void {
  if (live) posthog.capture(event, properties)
}

export function identify(distinctId: string, traits?: UserTraits): void {
  if (live) posthog.identify(distinctId, traits)
}

export function group(workspaceId: string, traits?: WorkspaceTraits): void {
  if (live) posthog.group(WORKSPACE_GROUP, workspaceId, traits)
}

export function reset(): void {
  if (live) posthog.reset()
}

// ── Consent ──────────────────────────────────────────────────────────────
export function grantConsent(): void {
  if (live) posthog.opt_in_capturing()
}
export function revokeConsent(): void {
  if (live) posthog.opt_out_capturing()
}
export function hasConsent(): boolean {
  return live && !posthog.has_opted_out_capturing()
}
export function isEnabled(): boolean {
  return live
}
