import { z } from "zod";

/**
 * Guide analytics contracts — the anonymous reader-engagement event log that
 * powers the guide analytics page. Mirrors the Forms results shape, but the
 * source of truth is a per-event table (GuideEvent) rather than counters.
 */

/** Reader-engagement event types (mirrors the GuideEventType enum in the DB). */
export const guideEventTypeSchema = z.enum([
  "view",
  "walkthrough_start",
  "walkthrough_step",
  "complete",
  "pdf_download",
  "language_switch",
  "mode_switch",
  "embed_open",
  "embed_submit",
  "session_end",
]);
export type GuideEventType = z.infer<typeof guideEventTypeSchema>;

/**
 * Event-specific context. Small, forward-compatible, no PII. `.strict()` drops
 * anything unexpected at the ingestion boundary. The trailing fields are stored
 * purely to future-proof analytics (not surfaced in the UI yet).
 */
export const guideEventContextSchema = z
  .object({
    stepIndex: z.number().int().min(0).max(1000).optional(),
    language: z.string().max(16).optional(),
    mode: z.enum(["list", "interactive"]).optional(),
    formId: z.string().max(64).optional(),
    durationMs: z.number().int().min(0).max(86_400_000).optional(),
    referrerHost: z.string().max(128).optional(),
    // Future-proof (stored, not surfaced):
    guideVersion: z.number().int().optional(),
    deviceType: z.enum(["mobile", "tablet", "desktop"]).optional(),
    browser: z.string().max(32).optional(),
    utmSource: z.string().max(128).optional(),
    utmMedium: z.string().max(128).optional(),
    utmCampaign: z.string().max(128).optional(),
  })
  .strict();
export type GuideEventContext = z.infer<typeof guideEventContextSchema>;

/** Batched beacon body — one session's events. */
export const ingestGuideEventsSchema = z.object({
  anonId: z.string().max(64).nullable(),
  sessionId: z.string().min(8).max(64),
  events: z
    .array(
      z.object({
        type: guideEventTypeSchema,
        context: guideEventContextSchema.optional(),
      })
    )
    .min(1)
    .max(50),
});
export type IngestGuideEventsInput = z.infer<typeof ingestGuideEventsSchema>;

/** Owner-facing analytics window. */
export const analyticsRangeSchema = z.enum(["7d", "30d", "90d"]);
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

export const ANALYTICS_RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Owner-facing aggregated analytics (single source of truth for API + web). */
export type GuideAnalytics = {
  range: AnalyticsRange;
  /** Lifetime view counter (denormalized on Guide) — a "since published" footnote. */
  lifetimeViews: number;
  publishedAt: string | null;
  totals: {
    views: number;
    uniqueViewers: number;
    avgTimeMs: number | null;
    completionRate: number;
    engagementRate: number;
  };
  trend: { date: string; views: number; completions: number }[];
  funnel: { viewed: number; started: number; completed: number; engaged: number };
  stepDropoff: { step: number; sessions: number }[];
  engagement: {
    reactions: number;
    comments: number;
    pdfDownloads: number;
    formSubmits: number;
    reactionsByEmoji: { emoji: string; count: number }[];
  };
  languages: { language: string; sessions: number }[];
  modes: { list: number; interactive: number };
  sources: { host: string; views: number }[];
};
