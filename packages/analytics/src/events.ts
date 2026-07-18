/**
 * The typed event catalog — the single source of truth for every analytics
 * event's name and payload. Adding an event = adding a key here; the browser,
 * server, and extension clients all constrain to this map, so an invalid event
 * name or a wrong property shape fails to compile.
 *
 * Conventions:
 *  - names are snake_case `object_action`
 *  - any event that concerns a workspace carries `workspaceId`
 *  - common metadata (platform, environment, app_version, build_sha, timestamp)
 *    is attached automatically by the client — never pass it here
 *  - client emits UI intent; server/worker emit authoritative outcomes
 */
export type AnalyticsEvents = {
  // ── Acquisition (client intent) ──────────────────────────────────────────
  cta_clicked: { location: string; label?: string }

  // ── Activation ───────────────────────────────────────────────────────────
  signed_up: { method: "email" | "google" }
  workspace_created: { workspaceId: string }
  capture_started: { source: "extension" | "upload" }
  capture_completed: {
    captureId: string
    workspaceId?: string
    stepCount: number
    durationMs: number
    provider: string
    model?: string
  }
  guide_created: { guideId: string; workspaceId: string; from: "capture" | "import" }
  guide_published: {
    guideId: string
    workspaceId: string
    stepCount: number
    hasVoiceover: boolean
  }
  guide_shared: { guideId: string; workspaceId?: string; channel: "link" | "embed" | "pdf" }

  // ── Feature usage (server / worker outcomes) ─────────────────────────────
  voiceover_generated: { guideId: string; language: string }
  translation_generated: { guideId: string; language: string }
  video_exported: { guideId: string; language: string; silent: boolean }
  help_center_published: { workspaceId: string }
  showcase_created: { workspaceId: string; showcaseId: string }
  form_published: { workspaceId: string; formId: string }

  // ── Team ─────────────────────────────────────────────────────────────────
  member_invited: { workspaceId: string; role: string }

  // ── Pipeline reliability (worker) ────────────────────────────────────────
  pipeline_failed: {
    stage: "capture" | "voice" | "translation" | "export"
    error: string
    guideId?: string
    captureId?: string
  }

  // ── Extension ────────────────────────────────────────────────────────────
  extension_installed: { version: string }
  extension_updated: { version: string; previousVersion?: string }
  extension_connected: { version: string }
  recording_started: Record<string, never>
  recording_completed: { stepCount: number; durationMs: number }
}

/** A valid event name. */
export type AnalyticsEvent = keyof AnalyticsEvents

/** The property payload for a given event. */
export type EventProperties<K extends AnalyticsEvent> = AnalyticsEvents[K]

/** Person traits set on identify. */
export type UserTraits = {
  email?: string
  name?: string
}

/** The one group type — a workspace (a better-auth organization). */
export const WORKSPACE_GROUP = "workspace" as const

/** Group traits set on group-identify. */
export type WorkspaceTraits = {
  name?: string
  slug?: string
  plan?: string
  member_count?: number
}
