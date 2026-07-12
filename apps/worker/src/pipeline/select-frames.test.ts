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
  next?: CaptureEvent;
  frame: string | undefined;
  pointer: boolean;
  source?: string;
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
    // ShowResult removed: an overlay (dropdown/menu/listbox/destination chrome)
    // never forces the after frame — a click always shows its control.
    name: "click + overlay + urlChanged (the Message case) → before, pointer",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true, overlayAppeared: true, urlChanged: true },
    }),
    frame: "B",
    pointer: true,
    source: "before",
  },
  {
    name: "click + overlay in place (no nav) → before, pointer (no ShowResult)",
    event: click({
      frames: { before: "B", after: "A" },
      settle: { mutated: true, overlayAppeared: true },
    }),
    frame: "B",
    pointer: true,
    source: "before",
  },
  {
    name: "input, next is a click → BORROWS the click's before frame",
    event: input({ frames: { before: "IB", after: "IA" } }),
    next: click({ frames: { before: "CB", after: "CA" } }),
    frame: "CB",
    pointer: true,
    source: "borrowed-next-click",
  },
  {
    name: "input, next is a navigation → fall back to input's own before",
    event: input({ frames: { before: "IB", after: "IA" } }),
    next: nav({ frames: { before: "NB" } }),
    frame: "IB",
    pointer: true,
    source: "before",
  },
  {
    name: "input, no following event → fall back to input's own before",
    event: input({ frames: { before: "IB", after: "IA" } }),
    frame: "IB",
    pointer: true,
    source: "before",
  },
  {
    name: "input, next click has no before frame → fall back to input's before",
    event: input({ frames: { before: "IB" } }),
    next: click({ frames: { after: "CA" } }),
    frame: "IB",
    pointer: true,
    source: "before",
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
  const got = selectFrame(c.event, { nextEvent: c.next });
  try {
    assert.equal(got.screenshotId, c.frame, `${c.name} — frame`);
    assert.equal(got.showPointer, c.pointer, `${c.name} — pointer`);
    if (c.source) assert.equal(got.source, c.source, `${c.name} — source`);
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
