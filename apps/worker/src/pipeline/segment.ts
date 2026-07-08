import type { CaptureEvent } from "@workspace/contracts/capture";

/**
 * Stage 2 — segment. Groups the normalized log into step candidates.
 * Currently: navigation events open a new segment; consecutive actions on
 * the same page stay together. The AI merges/splits further — this stage
 * exists so future heuristics (scroll suppression, dwell-time splits) have
 * a home without touching the AI layer.
 */
export type Segment = {
  events: CaptureEvent[];
  /** Index range into the normalized log (for traceability). */
  startIndex: number;
};

export function segment(events: CaptureEvent[]): Segment[] {
  const segments: Segment[] = [];
  let current: Segment | null = null;

  events.forEach((event, index) => {
    if (event.type === "navigation" || current === null) {
      current = { events: [], startIndex: index };
      segments.push(current);
    }
    current.events.push(event);
  });

  return segments;
}
