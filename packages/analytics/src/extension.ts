import { contextProperties, type AnalyticsContext } from "./context.js"
import type { AnalyticsEvent, AnalyticsEvents } from "./events.js"

export type ExtensionAnalyticsConfig = AnalyticsContext & {
  /** PostHog project API key. When absent, every call is a no-op. */
  key?: string
  /** Ingest host, e.g. https://us.i.posthog.com */
  host?: string
}

export type ExtensionAnalytics = {
  capture<K extends AnalyticsEvent>(
    distinctId: string,
    event: K,
    properties: AnalyticsEvents[K]
  ): Promise<void>
  readonly enabled: boolean
}

const noop: ExtensionAnalytics = { enabled: false, capture: async () => {} }

/**
 * Minimal fetch-based PostHog client for the browser extension. posthog-js
 * assumes a full window/DOM that the background service worker doesn't have, so
 * the extension posts capture events straight to PostHog's HTTP capture API —
 * using the same typed event catalog as web + server. No-op when `key` is
 * absent, and it never throws (analytics must not break capture).
 */
export function createExtensionAnalytics(config: ExtensionAnalyticsConfig): ExtensionAnalytics {
  if (!config.key) return noop

  const host = (config.host ?? "https://us.i.posthog.com").replace(/\/+$/, "")
  const endpoint = `${host}/i/v0/e/`
  const base = contextProperties("extension", config)
  const key = config.key

  return {
    enabled: true,
    async capture(distinctId, event, properties) {
      try {
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            api_key: key,
            event,
            distinct_id: distinctId,
            properties: { ...base, ...properties },
            timestamp: new Date().toISOString(),
          }),
        })
      } catch {
        // Swallow — analytics must never break the extension.
      }
    },
  }
}
