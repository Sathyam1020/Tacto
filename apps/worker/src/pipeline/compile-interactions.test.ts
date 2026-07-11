import assert from "node:assert/strict";

import type { CaptureEvent } from "@workspace/contracts/capture";

import { compileInteractions } from "./segment.js";

/**
 * Interaction Compiler regression suite. Deterministic structural grouping —
 * every rule change adds a fixture here. Run:
 * `npx tsx src/pipeline/compile-interactions.test.ts`.
 */

let t = 0;
function click(url: string, text = "Btn"): CaptureEvent {
  return {
    type: "click",
    timestamp: t++,
    url,
    target: { text, boundingBox: { x: 0, y: 0, w: 1, h: 1 } },
  } as CaptureEvent;
}
function nav(url: string, title = "Page"): CaptureEvent {
  return { type: "navigation", timestamp: t++, url, pageTitle: title } as CaptureEvent;
}
function input(url: string): CaptureEvent {
  return {
    type: "input",
    timestamp: t++,
    url,
    target: { text: "Field" },
    value: "x",
  } as CaptureEvent;
}

const A = "https://app.example.com/a";
const B = "https://app.example.com/b";
const EXT = "https://accounts.google.com/o";

const cases: {
  name: string;
  events: CaptureEvent[];
  expect: {
    count: number;
    primaries: number[];
    absorbedAt?: number[]; // interaction indexes that absorbed a nav
  };
}[] = [
  {
    name: "click → same-origin nav → absorbed into the click",
    events: [click(A), nav(B)],
    expect: { count: 1, primaries: [0], absorbedAt: [0] },
  },
  {
    name: "click → cross-origin nav (OAuth) → NOT absorbed",
    events: [click(A), nav(EXT)],
    expect: { count: 2, primaries: [0, 1], absorbedAt: [] },
  },
  {
    name: "standalone navigation (no preceding click) → own interaction",
    events: [nav(A)],
    expect: { count: 1, primaries: [0], absorbedAt: [] },
  },
  {
    name: "click → nav → nav (same origin run) → both fold into the click",
    events: [click(A), nav(B), nav(A)],
    expect: { count: 1, primaries: [0], absorbedAt: [0] },
  },
  {
    name: "click → nav (same) → nav (cross-origin) → only same-origin folds",
    events: [click(A), nav(B), nav(EXT)],
    expect: { count: 2, primaries: [0, 2], absorbedAt: [0] },
  },
  {
    name: "input → nav → not absorbed (only clicks absorb navigations)",
    events: [input(A), nav(B)],
    expect: { count: 2, primaries: [0, 1], absorbedAt: [] },
  },
  {
    name: "full flow: click→nav, click, click→nav",
    events: [click(A), nav(B), click(B, "Sign in"), click(B, "Next"), nav(A)],
    expect: { count: 3, primaries: [0, 2, 3], absorbedAt: [0, 2] },
  },
];

let failures = 0;
for (const c of cases) {
  const got = compileInteractions(c.events);
  try {
    assert.equal(got.length, c.expect.count, `${c.name} — interaction count`);
    assert.deepEqual(
      got.map((i) => i.primaryEventIndex),
      c.expect.primaries,
      `${c.name} — primaries`
    );
    const absorbed = got
      .map((i, idx) => (i.absorbedNavigation ? idx : -1))
      .filter((x) => x >= 0);
    assert.deepEqual(
      absorbed,
      c.expect.absorbedAt ?? [],
      `${c.name} — absorbed`
    );
    // Lossless: every event index appears exactly once across interactions.
    const refs = got.flatMap((i) => i.eventIndexes).sort((a, b) => a - b);
    assert.deepEqual(
      refs,
      c.events.map((_, i) => i),
      `${c.name} — lossless (all events referenced once)`
    );
    console.log(`✓ ${c.name}`);
  } catch (e) {
    failures++;
    console.error(`✗ ${c.name}\n  ${(e as Error).message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${cases.length} interaction fixtures FAILED`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} interaction fixtures passed.`);
