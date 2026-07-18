import { PostHog } from "posthog-node"

import { contextProperties, type AnalyticsContext } from "./context.js"
import {
  WORKSPACE_GROUP,
  type AnalyticsEvent,
  type AnalyticsEvents,
  type UserTraits,
  type WorkspaceTraits,
} from "./events.js"

export type ServerAnalyticsConfig = AnalyticsContext & {
  /** PostHog project API key. When absent, every call is a no-op. */
  key?: string
  /** Ingest host, e.g. https://us.i.posthog.com */
  host?: string
}

export type ServerAnalytics = {
  /** Fire a typed event for a user, optionally tagged to a workspace group. */
  capture<K extends AnalyticsEvent>(
    distinctId: string,
    event: K,
    properties: AnalyticsEvents[K],
    workspaceId?: string
  ): void
  /** Set person properties. */
  identify(distinctId: string, traits: UserTraits): void
  /** Set workspace (group) properties. */
  identifyWorkspace(workspaceId: string, traits: WorkspaceTraits): void
  /** Flush queued events — call in the process's shutdown handler. */
  shutdown(): Promise<void>
  /** Whether analytics is live (a key was provided). */
  readonly enabled: boolean
}

const noop: ServerAnalytics = {
  enabled: false,
  capture() {},
  identify() {},
  identifyWorkspace() {},
  shutdown: async () => {},
}

/**
 * Long-lived, batched PostHog client for Node services (api + worker). Returns a
 * no-op when `key` is absent, so local/preview environments run without PostHog.
 * Construct exactly one per process and call `shutdown()` from the graceful-
 * shutdown handler so batched events flush on deploy (SIGTERM).
 */
export function createServerAnalytics(config: ServerAnalyticsConfig): ServerAnalytics {
  if (!config.key) return noop

  const client = new PostHog(config.key, {
    host: config.host,
    flushAt: 20,
    flushInterval: 10_000,
  })
  const base = contextProperties("server", config)

  return {
    enabled: true,
    capture(distinctId, event, properties, workspaceId) {
      client.capture({
        distinctId,
        event,
        properties: { ...base, ...properties },
        ...(workspaceId ? { groups: { [WORKSPACE_GROUP]: workspaceId } } : {}),
      })
    },
    identify(distinctId, traits) {
      client.identify({ distinctId, properties: { ...traits } })
    },
    identifyWorkspace(workspaceId, traits) {
      client.groupIdentify({
        groupType: WORKSPACE_GROUP,
        groupKey: workspaceId,
        properties: { ...traits },
      })
    },
    shutdown: () => client.shutdown(),
  }
}
