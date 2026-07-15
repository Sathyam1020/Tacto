import assert from "node:assert/strict";

import type { FormField } from "@workspace/contracts/form";

import { computeAnalytics, computeSummary, toCsv, type SubmissionRow } from "./results.js";

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.message : err);
  }
}

function field(p: Partial<FormField> & { key: string; type: FormField["type"] }): FormField {
  return {
    key: p.key,
    type: p.type,
    title: p.title ?? "Q",
    description: "",
    required: false,
    config: {
      placeholder: "",
      maxLength: null,
      min: null,
      max: null,
      options: p.config?.options ?? [],
      allowOther: false,
      buttonText: "",
    },
  };
}

console.log("form results");

const now = new Date("2026-07-15T12:00:00.000Z");

test("computeAnalytics: rate, avg, filled trend", () => {
  const rows: SubmissionRow[] = [
    { answers: {}, durationMs: 10_000, createdAt: new Date("2026-07-15T09:00:00Z") },
    { answers: {}, durationMs: 20_000, createdAt: new Date("2026-07-15T10:00:00Z") },
    { answers: {}, durationMs: null, createdAt: new Date("2026-07-14T10:00:00Z") },
  ];
  const a = computeAnalytics({ views: 100, starts: 40, submissions: 20 }, rows, 7, now);
  assert.equal(a.completionRate, 50); // 20/40
  assert.equal(a.avgCompletionMs, 15_000); // (10k+20k)/2
  assert.equal(a.trend.length, 7); // filled
  assert.equal(a.trend.at(-1)!.count, 2); // today has 2
  assert.equal(a.trend.at(-2)!.count, 1); // yesterday has 1
});

test("computeSummary: choice counts, rating avg, text samples", () => {
  const fields = [
    field({ key: "c", type: "single_select", config: { options: [{ key: "a", label: "A" }, { key: "b", label: "B" }] } as never }),
    field({ key: "r", type: "rating" }),
    field({ key: "t", type: "short_text" }),
    field({ key: "s", type: "statement" }),
  ];
  const rows: SubmissionRow[] = [
    { answers: { c: "a", r: 4, t: "hi" }, durationMs: null, createdAt: now },
    { answers: { c: "a", r: 2, t: "yo" }, durationMs: null, createdAt: now },
    { answers: { c: "b" }, durationMs: null, createdAt: now },
  ];
  const s = computeSummary(fields, rows);
  assert.equal(s.length, 3); // statement excluded
  const c = s.find((x) => x.key === "c")!;
  assert.deepEqual(c.options, [{ label: "A", count: 2 }, { label: "B", count: 1 }]);
  const r = s.find((x) => x.key === "r")!;
  assert.equal(r.average, 3);
  const t = s.find((x) => x.key === "t")!;
  assert.deepEqual(t.samples, ["yo", "hi"]); // recent first
});

test("toCsv: header + rows, option labels + escaping", () => {
  const fields = [
    field({ key: "name", type: "short_text", title: "Full, Name" }),
    field({ key: "c", type: "single_select", title: "Pick", config: { options: [{ key: "a", label: "Ay" }] } as never }),
  ];
  const rows: SubmissionRow[] = [
    { answers: { name: 'He said "hi"', c: "a" }, durationMs: null, createdAt: new Date("2026-07-15T00:00:00Z") },
  ];
  const csv = toCsv(fields, rows);
  const lines = csv.split("\n");
  assert.match(lines[0]!, /Submitted at/); // header
  assert.match(lines[0]!, /"Full, Name"/); // title with comma quoted
  assert.match(lines[1]!, /"He said ""hi"""/); // escaped quotes
  assert.match(lines[1]!, /Ay/); // option label, not key
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll form results tests passed");
