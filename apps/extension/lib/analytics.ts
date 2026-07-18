import { createExtensionAnalytics } from "@workspace/analytics/extension"
import type { AnalyticsEvent, AnalyticsEvents } from "@workspace/analytics"

/**
 * Extension analytics — the single PostHog entry point for the extension, using
 * the shared typed event catalog. No-op when WXT_POSTHOG_KEY is unset. Events
 * are attributed to a stable, anonymous per-install device id (linking to the
 * signed-in Tacto user is a future improvement — the /api/extension/me endpoint
 * would need to return the user id).
 */
const client = createExtensionAnalytics({
  key: import.meta.env.WXT_POSTHOG_KEY as string | undefined,
  host: import.meta.env.WXT_POSTHOG_HOST as string | undefined,
  environment: import.meta.env.MODE,
  appVersion: chrome.runtime.getManifest().version,
})

export const APP_VERSION = chrome.runtime.getManifest().version

let deviceIdPromise: Promise<string> | null = null
function deviceId(): Promise<string> {
  if (!deviceIdPromise) {
    deviceIdPromise = chrome.storage.local
      .get("analyticsDeviceId")
      .then(({ analyticsDeviceId }) => {
        if (typeof analyticsDeviceId === "string") return analyticsDeviceId
        const id = crypto.randomUUID()
        void chrome.storage.local.set({ analyticsDeviceId: id })
        return id
      })
  }
  return deviceIdPromise
}

/** Fire a typed analytics event from the extension. Never throws. */
export async function track<K extends AnalyticsEvent>(
  event: K,
  properties: AnalyticsEvents[K]
): Promise<void> {
  try {
    await client.capture(await deviceId(), event, properties)
  } catch {
    /* analytics must never break the extension */
  }
}
