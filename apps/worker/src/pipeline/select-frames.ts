import type { CaptureEvent } from "@workspace/contracts/capture";

/** Where a step's chosen screenshot came from — surfaced for QA/debug. */
export type FrameSource =
  | "before"
  | "after"
  | "borrowed-next-click"
  | "legacy"
  | "none";

/**
 * The resolved frame for one step: which screenshot to show, whether a click
 * pointer belongs on it, and where the frame came from (for debugging).
 */
export type FrameChoice = {
  screenshotId: string | undefined;
  showPointer: boolean;
  source: FrameSource;
};

/**
 * Instruction-frame selection. The question is NOT "what event type is this?"
 * but "what visual helps the reader perform this instruction?". We map each
 * interaction to a frame INTENT, then to a frame:
 *
 *   LocateControl  (a click)        → before + pointer   — show WHERE to act
 *   ShowTypedValue (an input)       → the value frame     — show the value entered
 *   ShowDestination (a navigation)  → after              — show the page reached
 *   ShowResult (terminal + result)  → after              — show the completed state
 *
 * An INPUT's interaction completes when the value is committed, not while
 * typing. The immediately-following CLICK's `before` frame shows the field
 * holding the committed value while still on screen — the instructional moment,
 * captured via the fast pre-action path. So an input BORROWS that frame. Strict
 * adjacency: only the very next event, and only if it's a click (never across a
 * navigation or unrelated interaction). No next click → fall back to the input's
 * own `before` frame. This adds NO capture path — the borrowed frame already
 * exists.
 *
 * "click → before" is today's DEFAULT policy, not the final design: the long-term
 * job is answering the intent question above, and this is structured so richer
 * intents can be added without an event-type rewrite. Terminal ShowResult is
 * gated on a STRUCTURAL signal only (an overlay appeared on the last step) — no
 * text/keyword heuristics.
 *
 * Pure, ordered, fixture-tested. NO LLM, NO vision, NO keyword matching.
 */
export function selectFrame(
  event: CaptureEvent,
  opts?: { isTerminal?: boolean; nextEvent?: CaptureEvent }
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
    if (after) return { screenshotId: after, showPointer: false, source: "after" };
    if (before) return { screenshotId: before, showPointer: false, source: "before" };
    return {
      screenshotId: legacy,
      showPointer: false,
      source: legacy ? "legacy" : "none",
    };
  }

  // ShowTypedValue — borrow the following click's before frame (the field with
  // the committed value); else fall back to the input's own before frame.
  if (event.type === "input") {
    const next = opts?.nextEvent;
    const borrowed = next?.type === "click" ? next.frames?.before : undefined;
    if (borrowed) {
      return {
        screenshotId: borrowed,
        showPointer: hasBox,
        source: "borrowed-next-click",
      };
    }
    if (before) return { screenshotId: before, showPointer: hasBox, source: "before" };
    if (after) return { screenshotId: after, showPointer: hasBox, source: "after" };
    return {
      screenshotId: legacy,
      showPointer: hasBox,
      source: legacy ? "legacy" : "none",
    };
  }

  // ShowResult — ONLY on the terminal step, ONLY when an overlay appeared (a
  // structural completion signal). No keyword/text heuristics.
  if (opts?.isTerminal && after && event.settle?.overlayAppeared) {
    return { screenshotId: after, showPointer: false, source: "after" };
  }

  // LocateControl — the default for every click: show the control + pointer.
  // A legacy single-frame capture IS the control frame, so it gets the pointer.
  if (before) return { screenshotId: before, showPointer: hasBox, source: "before" };
  if (legacy) return { screenshotId: legacy, showPointer: hasBox, source: "legacy" };
  if (after) return { screenshotId: after, showPointer: false, source: "after" };
  return { screenshotId: undefined, showPointer: false, source: "none" };
}
