import type { GuideAnalytics } from "@workspace/contracts/guide-analytics";

/**
 * Guide analytics aggregation — pure and dependency-free so it's unit-testable
 * (kept out of the router, exactly like the Forms `results.ts`). Callers pass
 * already range-filtered rows; every metric is derived from the same rows as the
 * trend, so headline numbers and the chart never disagree.
 *
 * Robustness: `SESSION_END` is best-effort — only `avgTimeMs` depends on it
 * (null when absent). No metric requires it, so abrupt tab closes degrade
 * gracefully.
 */

/** DB enum values (uppercase) — kept as a local union to avoid a Prisma import. */
type EventType =
  | "VIEW"
  | "WALKTHROUGH_START"
  | "WALKTHROUGH_STEP"
  | "COMPLETE"
  | "PDF_DOWNLOAD"
  | "LANGUAGE_SWITCH"
  | "MODE_SWITCH"
  | "EMBED_OPEN"
  | "EMBED_SUBMIT"
  | "SESSION_END";

type EventContext = {
  stepIndex?: number;
  language?: string;
  mode?: string;
  formId?: string;
  durationMs?: number;
  referrerHost?: string;
} | null;

export type GuideEventRow = {
  type: EventType;
  anonId: string | null;
  sessionId: string;
  context: EventContext;
  createdAt: Date;
};

export type ReactionRow = { emoji: string; createdAt: Date };
export type CommentRow = { createdAt: Date };

export type AnalyticsMeta = {
  range: GuideAnalytics["range"];
  lifetimeViews: number;
  publishedAt: string | null;
};

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

/** Sessions engaged = did anything beyond landing on the page. */
const ENGAGEMENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  "WALKTHROUGH_START",
  "WALKTHROUGH_STEP",
  "PDF_DOWNLOAD",
  "LANGUAGE_SWITCH",
  "EMBED_OPEN",
  "EMBED_SUBMIT",
  "COMPLETE",
]);

function sessionSet(rows: GuideEventRow[], pred: (e: GuideEventRow) => boolean) {
  const s = new Set<string>();
  for (const e of rows) if (pred(e)) s.add(e.sessionId);
  return s;
}

function rate(numer: number, denom: number): number {
  return denom > 0 ? Math.round((numer / denom) * 100) : 0;
}

function topBy<T>(
  rows: GuideEventRow[],
  keyOf: (e: GuideEventRow) => string | undefined,
  limit: number,
  label: (key: string, sessions: number) => T
): T[] {
  // distinct sessions per key
  const byKey = new Map<string, Set<string>>();
  for (const e of rows) {
    const k = keyOf(e);
    if (!k) continue;
    let set = byKey.get(k);
    if (!set) {
      set = new Set();
      byKey.set(k, set);
    }
    set.add(e.sessionId);
  }
  return [...byKey.entries()]
    .map(([k, set]) => ({ k, n: set.size }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((x) => label(x.k, x.n));
}

export function computeGuideAnalytics(
  events: GuideEventRow[],
  reactions: ReactionRow[],
  comments: CommentRow[],
  days: number,
  now: Date,
  meta: AnalyticsMeta
): GuideAnalytics {
  const views = events.filter((e) => e.type === "VIEW");
  const completes = events.filter((e) => e.type === "COMPLETE");

  // ── Totals ─────────────────────────────────────────────────────────────
  const viewedSessions = sessionSet(events, (e) => e.type === "VIEW");
  const uniqueViewers = new Set(
    views.map((e) => e.anonId).filter((a): a is string => !!a)
  ).size;
  const durations = events
    .filter((e) => e.type === "SESSION_END")
    .map((e) => e.context?.durationMs)
    .filter((d): d is number => typeof d === "number" && d >= 0);
  const avgTimeMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const startedSessions = sessionSet(events, (e) => e.type === "WALKTHROUGH_START");
  const completedSessions = sessionSet(events, (e) => e.type === "COMPLETE");
  const engagedSessions = sessionSet(events, (e) => ENGAGEMENT_TYPES.has(e.type));

  const viewed = viewedSessions.size;

  // ── Trend (UTC day buckets, zero-filled, oldest→newest) ──────────────────
  const viewsByDay = new Map<string, number>();
  const compsByDay = new Map<string, number>();
  for (const e of views)
    viewsByDay.set(dayKey(e.createdAt), (viewsByDay.get(dayKey(e.createdAt)) ?? 0) + 1);
  for (const e of completes)
    compsByDay.set(dayKey(e.createdAt), (compsByDay.get(dayKey(e.createdAt)) ?? 0) + 1);
  const trend: GuideAnalytics["trend"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = dayKey(d);
    trend.push({
      date: key,
      views: viewsByDay.get(key) ?? 0,
      completions: compsByDay.get(key) ?? 0,
    });
  }

  // ── Step drop-off (walkthrough): max frame reached per session ───────────
  const maxStepBySession = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "WALKTHROUGH_STEP") continue;
    const idx = e.context?.stepIndex;
    if (typeof idx !== "number") continue;
    maxStepBySession.set(e.sessionId, Math.max(maxStepBySession.get(e.sessionId) ?? 0, idx));
  }
  const globalMax = Math.min(
    50,
    [...maxStepBySession.values()].reduce((m, v) => Math.max(m, v), -1)
  );
  const stepDropoff: GuideAnalytics["stepDropoff"] = [];
  for (let step = 0; step <= globalMax; step++) {
    let n = 0;
    for (const max of maxStepBySession.values()) if (max >= step) n++;
    stepDropoff.push({ step, sessions: n });
  }

  // ── Engagement breakdown ─────────────────────────────────────────────────
  const byEmoji = new Map<string, number>();
  for (const r of reactions) byEmoji.set(r.emoji, (byEmoji.get(r.emoji) ?? 0) + 1);

  const engagement: GuideAnalytics["engagement"] = {
    reactions: reactions.length,
    comments: comments.length,
    pdfDownloads: events.filter((e) => e.type === "PDF_DOWNLOAD").length,
    formSubmits: events.filter((e) => e.type === "EMBED_SUBMIT").length,
    reactionsByEmoji: [...byEmoji.entries()]
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count),
  };

  // ── Languages / modes / sources ──────────────────────────────────────────
  const languages = topBy(
    events.filter((e) => e.type === "LANGUAGE_SWITCH"),
    (e) => e.context?.language,
    12,
    (language, sessions) => ({ language, sessions })
  );
  const modeRows = events.filter((e) => e.type === "MODE_SWITCH");
  const modes = {
    list: sessionSet(modeRows, (e) => e.context?.mode === "list").size,
    interactive: sessionSet(modeRows, (e) => e.context?.mode === "interactive").size,
  };
  const sources = topBy(
    views,
    (e) => e.context?.referrerHost ?? "direct",
    8,
    (host, sessions) => ({ host, views: sessions })
  );

  return {
    range: meta.range,
    lifetimeViews: meta.lifetimeViews,
    publishedAt: meta.publishedAt,
    totals: {
      views: views.length,
      uniqueViewers,
      avgTimeMs,
      completionRate: rate(completedSessions.size, viewed),
      engagementRate: rate(engagedSessions.size, viewed),
    },
    trend,
    funnel: {
      viewed,
      started: startedSessions.size,
      completed: completedSessions.size,
      engaged: engagedSessions.size,
    },
    stepDropoff,
    engagement,
    languages,
    modes,
    sources,
  };
}
