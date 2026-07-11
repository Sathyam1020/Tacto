import type { CaptureEvent } from "@workspace/contracts/capture"

/**
 * An event as buffered during recording. Its candidate frames (before/after)
 * are captured by the background, keyed to the event by `seq`, and resolved to
 * R2 keys on the event's `frames` field on stop.
 */
export type RecordedEvent = CaptureEvent

export type Status = {
  connected: boolean
  workspaceName: string | null
  recording: boolean
  eventCount: number
  /** Web-app URL of the guide/capture after a successful stop. */
  lastCaptureUrl: string | null
  error: string | null
}
