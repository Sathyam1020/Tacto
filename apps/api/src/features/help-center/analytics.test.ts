import assert from "node:assert/strict";

import {
  computeHelpAnalytics,
  type ArticleViewRow,
  type HelpEventRow,
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

console.log("help center analytics");

const now = new Date("2026-07-16T12:00:00.000Z");
const today = (h = 10) => new Date(`2026-07-16T${String(h).padStart(2, "0")}:00:00Z`);
const yesterday = new Date("2026-07-15T10:00:00Z");

const ev = (
  type: HelpEventRow["type"],
  opts: Partial<HelpEventRow> = {}
): HelpEventRow => ({
  type,
  anonId: opts.anonId ?? null,
  sessionId: opts.sessionId ?? null,
  target: opts.target ?? null,
  zeroResults: opts.zeroResults ?? null,
  createdAt: opts.createdAt ?? today(),
});

const av = (opts: Partial<ArticleViewRow> = {}): ArticleViewRow => ({
  title: opts.title ?? "Getting started",
  slug: opts.slug ?? "getting-started",
  collectionSlug: opts.collectionSlug ?? "basics",
  anonId: opts.anonId ?? null,
  createdAt: opts.createdAt ?? today(),
});

test("totals: visits, searches, zero-result rate, article views", () => {
  const events: HelpEventRow[] = [
    ev("VIEW", { anonId: "a" }),
    ev("VIEW", { anonId: "b" }),
    ev("SEARCH", { target: "billing", zeroResults: false }),
    ev("SEARCH", { target: "refund", zeroResults: true }),
    ev("SEARCH", { target: "sso", zeroResults: true }),
    ev("CONTACT_CLICK", { anonId: "a" }),
  ];
  const a = computeHelpAnalytics(events, [av({ anonId: "a" })], 30, now, { range: "30d" });
  assert.equal(a.totals.visits, 2);
  assert.equal(a.totals.searches, 3);
  assert.equal(a.totals.zeroResultRate, 67); // 2 of 3
  assert.equal(a.totals.articleViews, 1);
});

test("uniqueVisitors: distinct anonIds across events + article views, nulls ignored", () => {
  const events = [ev("VIEW", { anonId: "a" }), ev("SEARCH", { anonId: null, target: "x" })];
  const a = computeHelpAnalytics(events, [av({ anonId: "b" }), av({ anonId: "a" })], 30, now, {
    range: "30d",
  });
  assert.equal(a.totals.uniqueVisitors, 2); // a, b
});

test("trend: zero-filled to `days`, buckets by UTC day", () => {
  const events = [
    ev("VIEW", { createdAt: today() }),
    ev("VIEW", { createdAt: today(14) }),
    ev("VIEW", { createdAt: yesterday }),
    ev("SEARCH", { createdAt: today(), target: "q" }),
  ];
  const a = computeHelpAnalytics(events, [av({ createdAt: today() })], 7, now, { range: "7d" });
  assert.equal(a.trend.length, 7);
  const last = a.trend[a.trend.length - 1]!;
  const prev = a.trend[a.trend.length - 2]!;
  assert.equal(last.date, "2026-07-16");
  assert.equal(last.visits, 2);
  assert.equal(last.searches, 1);
  assert.equal(last.articleViews, 1);
  assert.equal(prev.visits, 1); // yesterday
});

test("topArticles: grouped by collection/slug, counted, sorted desc", () => {
  const views = [
    av({ slug: "a", title: "A" }),
    av({ slug: "a", title: "A" }),
    av({ slug: "b", title: "B", collectionSlug: "guides" }),
  ];
  const a = computeHelpAnalytics([], views, 30, now, { range: "30d" });
  assert.equal(a.topArticles.length, 2);
  assert.deepEqual(a.topArticles[0], {
    title: "A",
    slug: "a",
    collectionSlug: "basics",
    views: 2,
  });
  assert.equal(a.topArticles[1]!.views, 1);
});

test("topSearches: normalized grouping (case/whitespace), zeroRate per query", () => {
  const events = [
    ev("SEARCH", { target: "Billing", zeroResults: false }),
    ev("SEARCH", { target: "  billing ", zeroResults: true }),
    ev("SEARCH", { target: "SSO", zeroResults: true }),
  ];
  const a = computeHelpAnalytics(events, [], 30, now, { range: "30d" });
  assert.equal(a.topSearches[0]!.query, "billing");
  assert.equal(a.topSearches[0]!.count, 2);
  assert.equal(a.topSearches[0]!.zeroRate, 50); // 1 of 2
  // zero-result list only surfaces queries that returned nothing
  const zeros = a.zeroResultSearches.map((z) => z.query).sort();
  assert.deepEqual(zeros, ["billing", "sso"]);
});

test("topCollections: grouped by slug, counted, sorted", () => {
  const events = [
    ev("COLLECTION_OPEN", { target: "basics" }),
    ev("COLLECTION_OPEN", { target: "basics" }),
    ev("COLLECTION_OPEN", { target: "billing" }),
  ];
  const a = computeHelpAnalytics(events, [], 30, now, { range: "30d" });
  assert.deepEqual(a.topCollections[0], { slug: "basics", opens: 2 });
  assert.equal(a.topCollections[1]!.slug, "billing");
});

test("empty input: zeros, empty widgets, full zero-filled trend", () => {
  const a = computeHelpAnalytics([], [], 30, now, { range: "30d" });
  assert.equal(a.totals.visits, 0);
  assert.equal(a.totals.zeroResultRate, 0);
  assert.equal(a.trend.length, 30);
  assert.deepEqual(a.topArticles, []);
  assert.deepEqual(a.topSearches, []);
  assert.deepEqual(a.zeroResultSearches, []);
  assert.deepEqual(a.topCollections, []);
});

if (failures > 0) {
  console.error(`\n${failures} help center analytics test(s) failed`);
  process.exit(1);
}
console.log("All help center analytics tests passed");
