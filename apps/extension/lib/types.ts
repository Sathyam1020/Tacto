import type { CaptureEvent } from "@workspace/contracts/capture"

/**
 * An event as buffered during recording. `_shotIndex` points into the
 * background's screenshot buffer; on stop it's resolved to an R2 key
 * (screenshotId) and stripped before submit.
 */
export type RecordedEvent = CaptureEvent & { _shotIndex?: number }

export type Status = {
  connected: boolean
  workspaceName: string | null
  recording: boolean
  eventCount: number
  /** Web-app URL of the guide/capture after a successful stop. */
  lastCaptureUrl: string | null
  error: string | null
}
