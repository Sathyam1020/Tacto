import type { HelpCenterAnalytics } from "@workspace/contracts/help-center";

/**
 * Help-center analytics aggregation — pure and dependency-free so it's
 * unit-testable (same shape as the guide `analytics.ts`). Callers pass already
 * range-filtered rows; every metric derives from the same rows as the trend so
 * headline numbers and the chart never disagree.
 */

type HcEventType = "VIEW" | "SEARCH" | "COLLECTION_OPEN" | "CONTACT_CLICK";

export type HelpEventRow = {
  type: HcEventType;
  anonId: string | null;
  sessionId: string | null;
  target: string | null;
  zeroResults: boolean | null;
  createdAt: Date;
};

/** One GuideEvent VIEW attributed to an article in this center. */
export type ArticleViewRow = {
  title: string;
  slug: string;
  collectionSlug: string;
  anonId: string | null;
  createdAt: Date;
};

export type HelpAnalyticsMeta = { range: HelpCenterAnalytics["range"] };

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

function rate(numer: number, denom: number): number {
  return denom > 0 ? Math.round((numer / denom) * 100) : 0;
}

/** Normalize a query for grouping (trim + collapse whitespace + lowercase). */
function normQuery(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export function computeHelpAnalytics(
  events: HelpEventRow[],
  articleViews: ArticleViewRow[],
  days: number,
  now: Date,
  meta: HelpAnalyticsMeta
): HelpCenterAnalytics {
  const views = events.filter((e) => e.type === "VIEW");
  const searches = events.filter((e) => e.type === "SEARCH");
  const opens = events.filter((e) => e.type === "COLLECTION_OPEN");

  const zeroSearches = searches.filter((e) => e.zeroResults === true);
  const uniqueVisitors = new Set(
    [...events, ...articleViews].map((e) => e.anonId).filter((a): a is string => !!a)
  ).size;

  // ── Trend (UTC day buckets, zero-filled, oldest→newest) ──────────────────
  const bump = (m: Map<string, number>, d: Date) =>
    m.set(dayKey(d), (m.get(dayKey(d)) ?? 0) + 1);
  const visitsByDay = new Map<string, number>();
  const searchesByDay = new Map<string, number>();
  const articleViewsByDay = new Map<string, number>();
  for (const e of views) bump(visitsByDay, e.createdAt);
  for (const e of searches) bump(searchesByDay, e.createdAt);
  for (const e of articleViews) bump(articleViewsByDay, e.createdAt);
  const trend: HelpCenterAnalytics["trend"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = dayKey(d);
    trend.push({
      date: key,
      visits: visitsByDay.get(key) ?? 0,
      searches: searchesByDay.get(key) ?? 0,
      articleViews: articleViewsByDay.get(key) ?? 0,
    });
  }

  // ── Top articles (by read count in this center) ──────────────────────────
  const byArticle = new Map<
    string,
    { title: string; slug: string; collectionSlug: string; views: number }
  >();
  for (const a of articleViews) {
    const k = `${a.collectionSlug}/${a.slug}`;
    const cur = byArticle.get(k);
    if (cur) cur.views += 1;
    else
      byArticle.set(k, {
        title: a.title,
        slug: a.slug,
        collectionSlug: a.collectionSlug,
        views: 1,
      });
  }
  const topArticles = [...byArticle.values()].sort((a, b) => b.views - a.views).slice(0, 8);

  // ── Searches (top + zero-result), grouped by normalized query ────────────
  const searchGroups = new Map<string, { count: number; zero: number }>();
  for (const e of searches) {
    if (!e.target) continue;
    const q = normQuery(e.target);
    if (!q) continue;
    const g = searchGroups.get(q) ?? { count: 0, zero: 0 };
    g.count += 1;
    if (e.zeroResults === true) g.zero += 1;
    searchGroups.set(q, g);
  }
  const topSearches = [...searchGroups.entries()]
    .map(([query, g]) => ({ query, count: g.count, zeroRate: rate(g.zero, g.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const zeroResultSearches = [...searchGroups.entries()]
    .filter(([, g]) => g.zero > 0)
    .map(([query, g]) => ({ query, count: g.zero }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── Top collections (by open count) ──────────────────────────────────────
  const byCollection = new Map<string, number>();
  for (const e of opens) {
    if (!e.target) continue;
    byCollection.set(e.target, (byCollection.get(e.target) ?? 0) + 1);
  }
  const topCollections = [...byCollection.entries()]
    .map(([slug, opensCount]) => ({ slug, opens: opensCount }))
    .sort((a, b) => b.opens - a.opens)
    .slice(0, 8);

  return {
    range: meta.range,
    totals: {
      visits: views.length,
      uniqueVisitors,
      searches: searches.length,
      zeroResultRate: rate(zeroSearches.length, searches.length),
      articleViews: articleViews.length,
    },
    trend,
    topArticles,
    topSearches,
    zeroResultSearches,
    topCollections,
  };
}
