import assert from "node:assert/strict";

import type { CaptureEvent } from "@workspace/contracts/capture";

import { selectFrame } from "./select-frames.js";

/**
 * Instruction-frame selector regression suite. The selector is the most
 * safety-critical heuristic in the pipeline: every rule change must add/adjust a
 * fixture here and keep the whole suite green.
 * Run: `npx tsx src/pipeline/select-frames.test.ts`.
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
  terminal?: boolean;
  frame: string | undefined;
  pointer: boolean;
}[] = [
  {
    name: "plain click, no mutation → before, pointer",
    event: click({ frames: { before: "B" }, settle: { mutated: false } }),
    frame: "B",
    pointer: true,
  },
  {
    name: "mid-flow click opens overlay → before (default), pointer",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true, overlayAppeared: true },
    }),
    frame: "B",
    pointer: true,
  },
  {
    name: "mid-flow click generic mutation → before, pointer",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true },
    }),
    frame: "B",
    pointer: true,
  },
  {
    name: "click that navigates → before, pointer",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true, urlChanged: true },
    }),
    frame: "B",
    pointer: true,
  },
  {
    name: "TERMINAL click + overlay appeared → after (result), no pointer",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true, overlayAppeared: true },
    }),
    terminal: true,
    frame: "A",
    pointer: false,
  },
  {
    name: "TERMINAL click, mutated but NO overlay → before (structural gate)",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true },
    }),
    terminal: true,
    frame: "B",
    pointer: true,
  },
  {
    name: "text input → after (typed value), pointer",
    event: input({
      frames: { before: "B", after: "A" },
      settle: { mutated: true },
    }),
    frame: "A",
    pointer: true,
  },
  {
    name: "input with no after → before, pointer",
    event: input({ frames: { before: "B" } }),
    frame: "B",
    pointer: true,
  },
  {
    name: "navigation → after (destination), no pointer",
    event: nav({ frames: { before: "B", after: "A" }, settle: { mutated: true } }),
    frame: "A",
    pointer: false,
  },
  {
    name: "navigation with only before → before, no pointer",
    event: nav({ frames: { before: "B" } }),
    frame: "B",
    pointer: false,
  },
  {
    name: "after-capture failed (mutated, no after key) → before, pointer",
    event: click({ frames: { before: "B" }, settle: { mutated: true } }),
    frame: "B",
    pointer: true,
  },
  {
    name: "legacy single-frame (screenshotId only) → that key, pointer",
    event: click({ screenshotId: "LEGACY" }),
    frame: "LEGACY",
    pointer: true,
  },
  {
    name: "click with no box (unlabeled target) → before, no pointer",
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
  const got = selectFrame(c.event, { isTerminal: c.terminal });
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
