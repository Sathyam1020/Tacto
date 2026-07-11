import type { CaptureEvent } from "@workspace/contracts/capture";

/**
 * The resolved frame for one event: which screenshot to show, and whether a
 * click pointer belongs on it.
 */
export type FrameChoice = {
  screenshotId: string | undefined;
  showPointer: boolean;
};

/**
 * Deterministic frame selector (M4). Given an event's candidate frames
 * (before/after) + factual settle observations, choose the most INSTRUCTIONAL
 * screenshot and whether to draw a click pointer on it.
 *
 * Pure, ordered rules — first match wins. NO LLM, NO vision. This is one of the
 * most-tested modules in the recorder: every heuristic change must add/adjust a
 * fixture and review the decision snapshot. Extend by inserting a rule above the
 * fallback.
 *
 * Rules:
 *   navigation                     → after ?? before ; pointer off (a destination)
 *   input                          → after ?? before ; pointer on  (shows the value)
 *   click & overlay appeared       → after           ; pointer off (modal/menu result)
 *   click & url changed            → before           ; pointer on  (nav step shows result)
 *   click & after exists (mutated) → after            ; pointer off (the result)
 *   click (nothing changed)        → before           ; pointer on  (where to click)
 *   fallback                       → before ?? after  ; pointer if a target box exists
 */
export function selectFrame(event: CaptureEvent): FrameChoice {
  const before = event.frames?.before;
  const after = event.frames?.after;
  const legacy = event.screenshotId; // single-frame captures / video imports
  const settle = event.settle;
  const hasBox =
    event.type !== "navigation" &&
    !!event.target.boundingBox &&
    !!event.viewport;

  if (event.type === "navigation") {
    return { screenshotId: after ?? before ?? legacy, showPointer: false };
  }

  if (event.type === "input") {
    return { screenshotId: after ?? before ?? legacy, showPointer: hasBox };
  }

  // event.type === "click"
  if (settle?.overlayAppeared && after) {
    return { screenshotId: after, showPointer: false };
  }
  if (settle?.urlChanged) {
    // Keep "where you clicked"; the navigation step shows the destination.
    if (before) return { screenshotId: before, showPointer: hasBox };
    return { screenshotId: after ?? legacy, showPointer: false };
  }
  if (after) {
    return { screenshotId: after, showPointer: false };
  }
  return { screenshotId: before ?? legacy, showPointer: hasBox };
}
