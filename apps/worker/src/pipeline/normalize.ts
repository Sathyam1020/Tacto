import {
  captureEventSchema,
  type CaptureEvent,
} from "@workspace/contracts/capture";
import { z } from "zod";

/**
 * Stage 1 — normalize. Pure function: raw stored events → clean ordered log.
 *  - validates against the contract (captures are external input)
 *  - sorts by timestamp
 *  - coalesces consecutive inputs into the same field (keystroke runs)
 *  - drops noise: empty-text click targets, zero-value inputs
 */
export function normalize(rawEvents: unknown): CaptureEvent[] {
  const events = z.array(captureEventSchema).parse(rawEvents);

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  const cleaned: CaptureEvent[] = [];
  for (const event of sorted) {
    // Noise: clicks on unlabeled elements carry no signal for the writer.
    if (event.type === "click" && !event.target.text.trim()) continue;
    if (event.type === "input" && !event.value.trim()) continue;

    // Coalesce: consecutive inputs into the same field keep only the final value.
    const previous = cleaned[cleaned.length - 1];
    if (
      event.type === "input" &&
      previous?.type === "input" &&
      previous.target.text === event.target.text &&
      previous.url === event.url
    ) {
      cleaned[cleaned.length - 1] = event;
      continue;
    }

    // Drop an accidental double-fire: the same element clicked twice in quick
    // succession (double-click, event re-dispatch) is one step, not two.
    if (
      event.type === "click" &&
      previous?.type === "click" &&
      previous.target.selector === event.target.selector &&
      previous.target.text === event.target.text &&
      event.timestamp - previous.timestamp < 700
    ) {
      continue;
    }

    // M0 — collapse consecutive navigations to the SAME url (SPA pushState
    // caught by the URL poll AND a hard reload/redirect both emit a nav event).
    // Keep the LATER one: its screenshot is the more-settled destination.
    // NOTE: we never merge a click with the navigation it caused — that's a
    // workflow decision, not the normalizer's job.
    if (
      event.type === "navigation" &&
      previous?.type === "navigation" &&
      previous.url === event.url
    ) {
      cleaned[cleaned.length - 1] = event;
      continue;
    }

    cleaned.push(event);
  }

  return cleaned;
}
