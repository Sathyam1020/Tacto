import type { CaptureEvent } from "@workspace/contracts/capture";

/**
 * The resolved frame for one step: which screenshot to show, and whether a
 * click pointer belongs on it.
 */
export type FrameChoice = {
  screenshotId: string | undefined;
  showPointer: boolean;
};

/**
 * Instruction-frame selection. The question is NOT "what event type is this?"
 * but "what visual helps the reader perform this instruction?". We map each
 * interaction to a frame INTENT, then to a frame:
 *
 *   LocateControl  (a click)        → before + pointer   — show WHERE to act
 *   ShowTypedValue (an input)       → after              — show the value entered
 *   ShowDestination (a navigation)  → after              — show the page reached
 *   ShowResult (terminal + result)  → after              — show the completed state
 *
 * "click → before" is today's DEFAULT policy, not the final design: the long-term
 * job is answering the intent question above, and this is structured so richer
 * intents can be added without an event-type rewrite.
 *
 * Terminal ShowResult is gated on a STRUCTURAL signal only — an overlay
 * (dialog/menu/tooltip) appeared on the last step. No text/keyword heuristics.
 * FUTURE: a richer "meaningful completed state" detector (toast roles, focus
 * changes) — left out until it can be done deterministically.
 *
 * Pure, ordered, fixture-tested. NO LLM, NO vision, NO keyword matching.
 */
export function selectFrame(
  event: CaptureEvent,
  opts?: { isTerminal?: boolean }
): FrameChoice {
  const before = event.frames?.before;
  const after = event.frames?.after;
  const legacy = event.screenshotId; // single-frame captures / video imports
  const hasBox =
    event.type !== "navigation" &&
    !!event.target.boundingBox &&
    !!event.viewport;

  // ShowDestination — a navigation's destination (never a pointer).
  if (event.type === "navigation") {
    return { screenshotId: after ?? before ?? legacy, showPointer: false };
  }

  // ShowTypedValue — the field with the value entered.
  if (event.type === "input") {
    return { screenshotId: after ?? before ?? legacy, showPointer: hasBox };
  }

  // ShowResult — ONLY on the terminal step, ONLY when an overlay appeared (a
  // structural completion signal). "Click Publish" as the last step can show the
  // success dialog; a mid-flow click never does.
  if (opts?.isTerminal && after && event.settle?.overlayAppeared) {
    return { screenshotId: after, showPointer: false };
  }

  // LocateControl — the default for every click: show the control + pointer.
  // A legacy single-frame capture IS the control frame, so it gets the pointer.
  const control = before ?? legacy;
  if (control) return { screenshotId: control, showPointer: hasBox };
  return { screenshotId: after, showPointer: false };
}
