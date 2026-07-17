import assert from "node:assert/strict";

import { computeShowcaseAnalytics, type ShowcaseEventRow } from "./analytics.js";

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

console.log("showcase analytics");

const now = new Date("2026-07-17T12:00:00.000Z");
const today = (h = 10) => new Date(`2026-07-17T${String(h).padStart(2, "0")}:00:00Z`);
const yesterday = new Date("2026-07-16T10:00:00Z");

const ev = (type: ShowcaseEventRow["type"], opts: Partial<ShowcaseEventRow> = {}): ShowcaseEventRow => ({
  type,
  anonId: opts.anonId ?? null,
  sessionId: opts.sessionId ?? null,
  target: opts.target ?? null,
  createdAt: opts.createdAt ?? today(),
});

const titles = { i1: "Getting started", i2: "Connect your data" };

test("totals: views, unique visitors, item opens", () => {
  const a = computeShowcaseAnalytics(
    [
      ev("VIEW", { anonId: "a", sessionId: "s1" }),
      ev("VIEW", { anonId: "a", sessionId: "s2" }),
      ev("VIEW", { anonId: "b", sessionId: "s3" }),
      ev("ITEM_OPEN", { anonId: "a", sessionId: "s1", target: "i1" }),
      ev("ITEM_OPEN", { anonId: "b", sessionId: "s3", target: "i2" }),
    ],
    titles,
    30,
    now,
    { range: "30d" }
  );
  assert.equal(a.totals.views, 3);
  assert.equal(a.totals.uniqueVisitors, 2); // a + b
  assert.equal(a.totals.itemOpens, 2);
});

test("completion rate = complete sessions ÷ view sessions", () => {
  const a = computeShowcaseAnalytics(
    [
      ev("VIEW", { sessionId: "s1" }),
      ev("VIEW", { sessionId: "s2" }),
      ev("VIEW", { sessionId: "s3" }),
      ev("VIEW", { sessionId: "s4" }),
      ev("COMPLETE", { sessionId: "s1" }),
    ],
    titles,
    30,
    now,
    { range: "30d" }
  );
  assert.equal(a.totals.completionRate, 25); // 1 of 4 view sessions completed
});

test("completion rate is 0 with no views", () => {
  const a = computeShowcaseAnalytics([], titles, 7, now, { range: "7d" });
  assert.equal(a.totals.completionRate, 0);
});

test("trend: zero-filled, right length, oldest→newest, buckets by UTC day", () => {
  const a = computeShowcaseAnalytics(
    [
      ev("VIEW", { createdAt: today() }),
      ev("VIEW", { createdAt: today(14) }),
      ev("VIEW", { createdAt: yesterday }),
      ev("ITEM_OPEN", { target: "i1", createdAt: today() }),
    ],
    titles,
    7,
    now,
    { range: "7d" }
  );
  assert.equal(a.trend.length, 7);
  assert.equal(a.trend[0]!.date, "2026-07-11");
  assert.equal(a.trend[6]!.date, "2026-07-17");
  assert.equal(a.trend[6]!.views, 2); // two views today
  assert.equal(a.trend[5]!.views, 1); // one yesterday
  assert.equal(a.trend[6]!.itemOpens, 1);
});

test("per-item opens + completes, sorted by opens, titles resolved", () => {
  const a = computeShowcaseAnalytics(
    [
      ev("ITEM_OPEN", { target: "i1" }),
      ev("ITEM_OPEN", { target: "i1" }),
      ev("ITEM_OPEN", { target: "i2" }),
      ev("ITEM_COMPLETE", { target: "i1" }),
    ],
    titles,
    30,
    now,
    { range: "30d" }
  );
  assert.equal(a.topItems.length, 2);
  assert.equal(a.topItems[0]!.itemId, "i1");
  assert.equal(a.topItems[0]!.title, "Getting started");
  assert.equal(a.topItems[0]!.opens, 2);
  assert.equal(a.topItems[0]!.completes, 1);
  assert.equal(a.topItems[1]!.opens, 1);
});

test("unknown item id falls back to 'Removed item'", () => {
  const a = computeShowcaseAnalytics([ev("ITEM_OPEN", { target: "gone" })], titles, 30, now, {
    range: "30d",
  });
  assert.equal(a.topItems[0]!.title, "Removed item");
});

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
