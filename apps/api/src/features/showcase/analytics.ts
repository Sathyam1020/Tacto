import type { ShowcaseAnalytics, ShowcaseAnalyticsRange } from "@workspace/contracts/showcase";

/**
 * Showcase analytics aggregation — pure and dependency-free so it's
 * unit-testable (same shape as the guide + help-center `analytics.ts`). Callers
 * pass already range-filtered rows plus a title lookup; every metric derives
 * from the same rows as the trend so headline numbers and the chart never
 * disagree. Per-item guide *reads* live in GuideEvent (tagged
 * `source="showcase:{slug}"`); this covers showcase-level engagement only.
 */

type ScEventType = "VIEW" | "ITEM_OPEN" | "ITEM_COMPLETE" | "COMPLETE" | "CONTACT_CLICK";

export type ShowcaseEventRow = {
  type: ScEventType;
  anonId: string | null;
  sessionId: string | null;
  target: string | null;
  createdAt: Date;
};

export type ShowcaseAnalyticsMeta = { range: ShowcaseAnalyticsRange };

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

function rate(numer: number, denom: number): number {
  return denom > 0 ? Math.round((numer / denom) * 100) : 0;
}

export function computeShowcaseAnalytics(
  events: ShowcaseEventRow[],
  itemTitles: Record<string, string>,
  days: number,
  now: Date,
  meta: ShowcaseAnalyticsMeta
): ShowcaseAnalytics {
  const views = events.filter((e) => e.type === "VIEW");
  const itemOpens = events.filter((e) => e.type === "ITEM_OPEN");
  const itemCompletes = events.filter((e) => e.type === "ITEM_COMPLETE");
  const completes = events.filter((e) => e.type === "COMPLETE");

  const uniqueVisitors = new Set(
    events.map((e) => e.anonId).filter((a): a is string => !!a)
  ).size;

  // Completion rate = sessions that reached COMPLETE ÷ sessions that viewed.
  const viewSessions = new Set(views.map((e) => e.sessionId).filter((s): s is string => !!s));
  const completeSessions = new Set(
    completes.map((e) => e.sessionId).filter((s): s is string => !!s)
  );
  const completionRate = rate(completeSessions.size, viewSessions.size);

  // ── Trend (UTC day buckets, zero-filled, oldest→newest) ──────────────────
  const bump = (m: Map<string, number>, d: Date) =>
    m.set(dayKey(d), (m.get(dayKey(d)) ?? 0) + 1);
  const viewsByDay = new Map<string, number>();
  const opensByDay = new Map<string, number>();
  for (const e of views) bump(viewsByDay, e.createdAt);
  for (const e of itemOpens) bump(opensByDay, e.createdAt);
  const trend: ShowcaseAnalytics["trend"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = dayKey(d);
    trend.push({ date: key, views: viewsByDay.get(key) ?? 0, itemOpens: opensByDay.get(key) ?? 0 });
  }

  // ── Per-item engagement (opens + completes → drop-off) ───────────────────
  const byItem = new Map<string, { opens: number; completes: number }>();
  const touch = (id: string) => byItem.get(id) ?? { opens: 0, completes: 0 };
  for (const e of itemOpens) {
    if (!e.target) continue;
    const g = touch(e.target);
    g.opens += 1;
    byItem.set(e.target, g);
  }
  for (const e of itemCompletes) {
    if (!e.target) continue;
    const g = touch(e.target);
    g.completes += 1;
    byItem.set(e.target, g);
  }
  const topItems = [...byItem.entries()]
    .map(([itemId, g]) => ({
      itemId,
      title: itemTitles[itemId] ?? "Removed item",
      opens: g.opens,
      completes: g.completes,
    }))
    .sort((a, b) => b.opens - a.opens || b.completes - a.completes)
    .slice(0, 10);

  return {
    range: meta.range,
    totals: {
      views: views.length,
      uniqueVisitors,
      completionRate,
      itemOpens: itemOpens.length,
    },
    trend,
    topItems,
  };
}
