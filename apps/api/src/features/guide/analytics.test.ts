import assert from "node:assert/strict";

import {
  computeGuideAnalytics,
  type CommentRow,
  type GuideEventRow,
  type ReactionRow,
} from "./analytics.js";

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

console.log("guide analytics");

const now = new Date("2026-07-15T12:00:00.000Z");
const today = (h = 10) => new Date(`2026-07-15T${String(h).padStart(2, "0")}:00:00Z`);
const yesterday = new Date("2026-07-14T10:00:00Z");

type Ctx = GuideEventRow["context"];
const ev = (
  type: GuideEventRow["type"],
  sessionId: string,
  opts: { anonId?: string | null; context?: Ctx; createdAt?: Date } = {}
): GuideEventRow => ({
  type,
  sessionId,
  anonId: opts.anonId ?? null,
  context: opts.context ?? null,
  createdAt: opts.createdAt ?? today(),
});

const meta = { range: "7d" as const, lifetimeViews: 123, publishedAt: null };

test("trend: zero-filled to `days`, buckets views + completions by UTC day", () => {
  const events: GuideEventRow[] = [
    ev("VIEW", "s1", { createdAt: today(9) }),
    ev("VIEW", "s2", { createdAt: today(10) }),
    ev("VIEW", "s3", { createdAt: yesterday }),
    ev("COMPLETE", "s1", { createdAt: today(9) }),
  ];
  const a = computeGuideAnalytics(events, [], [], 7, now, meta);
  assert.equal(a.trend.length, 7);
  assert.equal(a.trend.at(-1)!.views, 2); // today
  assert.equal(a.trend.at(-1)!.completions, 1);
  assert.equal(a.trend.at(-2)!.views, 1); // yesterday
  assert.equal(a.trend.at(-2)!.completions, 0);
  assert.equal(a.lifetimeViews, 123);
});

test("totals: views count events, uniqueViewers dedup anonId (nulls ignored)", () => {
  const events: GuideEventRow[] = [
    ev("VIEW", "s1", { anonId: "a" }),
    ev("VIEW", "s2", { anonId: "a" }), // same viewer, 2 sessions
    ev("VIEW", "s3", { anonId: "b" }),
    ev("VIEW", "s4", { anonId: null }), // private mode — 0 unique contribution
  ];
  const a = computeGuideAnalytics(events, [], [], 7, now, meta);
  assert.equal(a.totals.views, 4);
  assert.equal(a.totals.uniqueViewers, 2); // a, b
  assert.equal(a.funnel.viewed, 4);
});

test("avgTimeMs: null without session_end, mean of durations otherwise", () => {
  const base: GuideEventRow[] = [ev("VIEW", "s1"), ev("VIEW", "s2")];
  assert.equal(computeGuideAnalytics(base, [], [], 7, now, meta).totals.avgTimeMs, null);

  const withEnd: GuideEventRow[] = [
    ...base,
    ev("SESSION_END", "s1", { context: { durationMs: 10_000 } }),
    ev("SESSION_END", "s2", { context: { durationMs: 20_000 } }),
  ];
  assert.equal(computeGuideAnalytics(withEnd, [], [], 7, now, meta).totals.avgTimeMs, 15_000);
});

test("funnel + rates: session-scoped, completion/engagement over viewed", () => {
  const events: GuideEventRow[] = [
    // s1: viewed + started + completed (fully engaged)
    ev("VIEW", "s1"),
    ev("WALKTHROUGH_START", "s1"),
    ev("WALKTHROUGH_STEP", "s1", { context: { stepIndex: 0 } }),
    ev("WALKTHROUGH_STEP", "s1", { context: { stepIndex: 1 } }),
    ev("COMPLETE", "s1"),
    // s2: viewed + engaged (pdf) but not completed
    ev("VIEW", "s2"),
    ev("PDF_DOWNLOAD", "s2"),
    // s3: viewed only (bounced)
    ev("VIEW", "s3"),
    ev("VIEW", "s4"),
  ];
  const a = computeGuideAnalytics(events, [], [], 7, now, meta);
  assert.equal(a.funnel.viewed, 4);
  assert.equal(a.funnel.started, 1);
  assert.equal(a.funnel.completed, 1);
  assert.equal(a.funnel.engaged, 2); // s1, s2
  assert.equal(a.totals.completionRate, 25); // 1/4
  assert.equal(a.totals.engagementRate, 50); // 2/4
});

test("stepDropoff: descending sessions reaching >= step", () => {
  const events: GuideEventRow[] = [
    // s1 reached step 2, s2 reached step 1, s3 reached step 0
    ev("WALKTHROUGH_STEP", "s1", { context: { stepIndex: 0 } }),
    ev("WALKTHROUGH_STEP", "s1", { context: { stepIndex: 2 } }),
    ev("WALKTHROUGH_STEP", "s2", { context: { stepIndex: 0 } }),
    ev("WALKTHROUGH_STEP", "s2", { context: { stepIndex: 1 } }),
    ev("WALKTHROUGH_STEP", "s3", { context: { stepIndex: 0 } }),
  ];
  const a = computeGuideAnalytics(events, [], [], 7, now, meta);
  assert.deepEqual(
    a.stepDropoff.map((s) => s.sessions),
    [3, 2, 1] // step0:3, step1:2, step2:1 — monotonic non-increasing
  );
});

test("engagement + languages + modes + sources", () => {
  const reactions: ReactionRow[] = [
    { emoji: "👍", createdAt: today() },
    { emoji: "👍", createdAt: today() },
    { emoji: "🎉", createdAt: today() },
  ];
  const comments: CommentRow[] = [{ createdAt: today() }];
  const events: GuideEventRow[] = [
    ev("VIEW", "s1", { context: { referrerHost: "notion.so" } }),
    ev("VIEW", "s2", { context: { referrerHost: "notion.so" } }),
    ev("VIEW", "s3", { context: { referrerHost: "direct" } }),
    ev("PDF_DOWNLOAD", "s1"),
    ev("EMBED_SUBMIT", "s2", { context: { formId: "f1" } }),
    ev("LANGUAGE_SWITCH", "s1", { context: { language: "es" } }),
    ev("LANGUAGE_SWITCH", "s2", { context: { language: "es" } }),
    ev("MODE_SWITCH", "s1", { context: { mode: "interactive" } }),
    ev("MODE_SWITCH", "s2", { context: { mode: "list" } }),
    ev("MODE_SWITCH", "s3", { context: { mode: "list" } }),
  ];
  const a = computeGuideAnalytics(events, reactions, comments, 7, now, meta);
  assert.equal(a.engagement.reactions, 3);
  assert.equal(a.engagement.comments, 1);
  assert.equal(a.engagement.pdfDownloads, 1);
  assert.equal(a.engagement.formSubmits, 1);
  assert.deepEqual(a.engagement.reactionsByEmoji, [
    { emoji: "👍", count: 2 },
    { emoji: "🎉", count: 1 },
  ]);
  assert.deepEqual(a.languages, [{ language: "es", sessions: 2 }]);
  assert.deepEqual(a.modes, { list: 2, interactive: 1 });
  assert.deepEqual(a.sources, [
    { host: "notion.so", views: 2 },
    { host: "direct", views: 1 },
  ]);
});

test("empty input: zeros, null avg, empty widgets", () => {
  const a = computeGuideAnalytics([], [], [], 30, now, {
    range: "30d",
    lifetimeViews: 0,
    publishedAt: null,
  });
  assert.equal(a.totals.views, 0);
  assert.equal(a.totals.completionRate, 0);
  assert.equal(a.totals.avgTimeMs, null);
  assert.equal(a.trend.length, 30);
  assert.deepEqual(a.stepDropoff, []);
  assert.deepEqual(a.languages, []);
  assert.deepEqual(a.sources, []);
});

if (failures > 0) {
  console.error(`\n${failures} guide analytics test(s) failed`);
  process.exit(1);
}
console.log("All guide analytics tests passed");
