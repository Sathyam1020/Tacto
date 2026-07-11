import assert from "node:assert/strict";

import type { CaptureEvent } from "@workspace/contracts/capture";

import { selectFrame } from "./select-frames.js";

/**
 * Frame-selector regression suite. The selector is the most safety-critical
 * heuristic in the recorder: every rule change must add/adjust a fixture here
 * and keep the whole suite green. Run: `npx tsx src/pipeline/select-frames.test.ts`.
 *
 * Dependency-free on purpose (Node's assert + tsx) so it runs anywhere without
 * pulling in a test framework.
 */

const BOX = { x: 100, y: 100, w: 120, h: 40 };
const VP = { w: 1440, h: 900 };

function click(over: Partial<CaptureEvent> = {}): CaptureEvent {
  return {
    type: "click",
    timestamp: 0,
    url: "https://app.example.com",
    viewport: VP,
    target: { text: "Create", boundingBox: BOX },
    ...(over as object),
  } as CaptureEvent;
}
function input(over: Partial<CaptureEvent> = {}): CaptureEvent {
  return {
    type: "input",
    timestamp: 0,
    url: "https://app.example.com",
    viewport: VP,
    target: { text: "Name", boundingBox: BOX },
    value: "tacto",
    ...(over as object),
  } as CaptureEvent;
}
function nav(over: Partial<CaptureEvent> = {}): CaptureEvent {
  return {
    type: "navigation",
    timestamp: 0,
    url: "https://app.example.com/next",
    ...(over as object),
  } as CaptureEvent;
}

const cases: {
  name: string;
  event: CaptureEvent;
  frame: string | undefined;
  pointer: boolean;
}[] = [
  {
    name: "plain click, no DOM mutation → before, pointer on",
    event: click({ frames: { before: "B" }, settle: { mutated: false } }),
    frame: "B",
    pointer: true,
  },
  {
    name: "click opens dropdown/menu (overlay) → after, pointer off",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true, overlayAppeared: true },
    }),
    frame: "A",
    pointer: false,
  },
  {
    name: "click opens modal (overlay) → after, pointer off",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true, overlayAppeared: true },
    }),
    frame: "A",
    pointer: false,
  },
  {
    name: "click causes generic content change → after, pointer off",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true },
    }),
    frame: "A",
    pointer: false,
  },
  {
    name: "click that navigates → before (nav step shows result), pointer on",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true, urlChanged: true },
    }),
    frame: "B",
    pointer: true,
  },
  {
    name: "text input → after (shows typed value), pointer on",
    event: input({
      frames: { before: "B", after: "A" },
      settle: { mutated: true },
    }),
    frame: "A",
    pointer: true,
  },
  {
    name: "input with no after → before, pointer on",
    event: input({ frames: { before: "B" } }),
    frame: "B",
    pointer: true,
  },
  {
    name: "navigation → after (destination), pointer off",
    event: nav({ frames: { before: "B", after: "A" }, settle: { mutated: true } }),
    frame: "A",
    pointer: false,
  },
  {
    name: "navigation with only before → before, pointer off",
    event: nav({ frames: { before: "B" } }),
    frame: "B",
    pointer: false,
  },
  {
    name: "after-capture failed (mutated but no after key) → before, pointer on",
    event: click({ frames: { before: "B" }, settle: { mutated: true } }),
    frame: "B",
    pointer: true,
  },
  {
    name: "legacy single-frame capture (screenshotId only) → that key, pointer on",
    event: click({ screenshotId: "LEGACY" }),
    frame: "LEGACY",
    pointer: true,
  },
  {
    name: "click with no box (unlabeled target) → before, pointer off",
    event: {
      type: "click",
      timestamp: 0,
      url: "https://app.example.com",
      target: { text: "x" },
      frames: { before: "B" },
      settle: { mutated: false },
    } as CaptureEvent,
    frame: "B",
    pointer: false,
  },
];

let failures = 0;
for (const c of cases) {
  const got = selectFrame(c.event);
  try {
    assert.equal(got.screenshotId, c.frame, `${c.name} — frame`);
    assert.equal(got.showPointer, c.pointer, `${c.name} — pointer`);
    console.log(`✓ ${c.name}`);
  } catch (e) {
    failures++;
    console.error(`✗ ${c.name}\n  ${(e as Error).message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${cases.length} selector fixtures FAILED`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} selector fixtures passed.`);
