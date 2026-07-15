# Phase 12 — Guide Analytics — RFC

**Status:** Proposed · **Author:** Principal Eng · **Date:** 2026-07-15
**Scope:** `apps/web`, `apps/api`, `packages/{contracts,db,ui}` · **Guides only** (Forms already ship analytics)

---

## 1. Summary

A first-class **Analytics page for a published guide** — who's reading it, how far they get, and how they engage — built on a proper **event log** rather than the single blind counter guides carry today.

Today a guide has exactly one metric: `Guide.viewCount`, a lifetime integer incremented on every public page load, with **no dedup, no viewer identity, and no timestamp** (`apps/api/src/features/public/router.ts:95`). Everything else a reader does — switch to the walkthrough, reach step 7, download the PDF, change language, react, comment, open an embedded form — is either invisible to the backend or lives in a table we never aggregate for the owner. There is a stub `GET /api/guides/:id/analytics` that returns `{ viewCount, status, publishedAt, blockCount }` (`apps/api/src/features/guide/router.ts:689`) and a 4-row "Analytics" dialog on the guide page (`apps/web/app/(app)/guides/[id]/page.tsx:314`). Neither is real analytics.

This RFC introduces:

- **A `GuideEvent` log** — a lightweight, append-only, anonymous event row (`view`, `walkthrough_start`, `walkthrough_step`, `complete`, `pdf_download`, `language_switch`, `mode_switch`, `embed_open`, `embed_submit`, `session_end`) with `anonId`, `sessionId`, `createdAt`, and a small `context` JSON. This is the one net-new primitive; everything else derives from it plus the reaction/comment rows we already store.
- **A public beacon endpoint** `POST /api/public/guides/:shareId/events` — batched, fire-and-forget, rate-limited, no-auth — fed by a tiny client tracker wired into the public reader.
- **A pure aggregation module** `guide-analytics.ts` (mirroring the Forms `results.ts` pattern) + an owner-facing `GET /api/guides/:id/analytics?range=7d|30d|90d`.
- **A dedicated Analytics page** at `/guides/{id}/analytics` — headline stat cards, a views-over-time trend (reusing the Forms `TrendChart` SVG), a **read funnel** (viewed → started walkthrough → completed → engaged), **walkthrough step drop-off**, an **engagement** breakdown (reactions / comments / PDF / embedded-form conversions), **top languages**, **mode split** (scroll vs walkthrough), and **traffic sources**.

### Guiding principles (house style)
Draft first · Publish later · **No duplicate systems** · **Reuse existing infrastructure** (the Forms analytics stack is the template) · Every phase compiles/lints/tests/ships · **Never silently change existing behavior** (one deliberate change to view-counting is called out in §11) · Privacy by default (anonymous, no PII, no new cookies).

### Non-goals (v1 — deferred)
- Per-viewer **session replay**, heatmaps, scroll maps.
- **Geo / IP** enrichment beyond referrer host (no IP geolocation, no country tables).
- **Real-time** streaming dashboards (v1 is query-on-load with a range filter + manual refresh).
- **Retention cohorts**, A/B testing, unique-visitor identity resolution across devices.
- **Bot filtering** beyond a trivial UA/`sendBeacon`-only heuristic.
- A **daily rollup table** + pruning job (designed for in §12; v1 queries the raw event table, which is ample at current scale).
- Analytics for **Forms** (already shipped) and for **DRAFT** guides (nothing to measure until published).

---

## 2. What exists today (grounding)

| Concern | Today | Ref |
|---|---|---|
| View count | Lifetime `Int`, incremented blind on every GET, no dedup/identity/time | `public/router.ts:95`, `schema.prisma:337` |
| Anonymous identity | `localStorage["tacto_anon_id"]` (`crypto.randomUUID()`), sent on reactions + form submits, **not** on guide view | `guide-feedback.tsx:14`, `public-form-view.tsx:17` |
| Reactions | `GuideReaction` rows w/ `createdAt` + `anonId`, unique `(guideId,anonId,emoji)`; aggregated by emoji on the public read only | `schema.prisma:435`, `public/router.ts:22` |
| Comments | `GuideComment` rows w/ `createdAt` (no anonId) | `schema.prisma:449` |
| Embedded-form conversions | `FormSubmission.metadata.guideId` (JSON, **not indexed**), `durationMs`, `createdAt` | `public-form-view.tsx:155`, `schema.prisma:266` |
| Walkthrough / PDF / language / mode | **Client-only, untracked** | `interactive-view.tsx`, `public-guide-view.tsx:117-135` |
| Owner analytics API | Stub: `{ viewCount, status, publishedAt, blockCount }` | `guide/router.ts:689` |
| Owner analytics UI | 4-row dialog off the `⋯` menu | `guides/[id]/page.tsx:314,448` |
| Forms analytics (the template to mirror) | `computeAnalytics` (pure, tested) + `/analytics?range` + hand-rolled `TrendChart` + stat-card grid | `form/results.ts:36`, `form/router.ts:440`, `trend-chart.tsx` |

**Conclusion:** the reaction/comment tables already give us time-series engagement; the entire *reading* experience (views deduped, walkthrough depth, completion, PDF, language, mode, embed funnel) has no backend footprint. One event table closes that gap and unlocks every metric below.

---

## 3. Metrics catalog (what the page shows)

All range-scoped (`7d` / `30d` / `90d`) unless noted. "Session" = one page-load (a `sessionId`); "viewer" = one `anonId`.

**Headline cards**
- **Views** — count of `view` events in range.
- **Unique viewers** — distinct `anonId` with a `view` in range.
- **Avg. time on guide** — mean `context.durationMs` from `session_end` (mirrors Forms `avgCompletionMs`).
- **Completion rate** — sessions with `complete` ÷ sessions with `view` (%).
- **Engagement rate** — sessions with any engagement (reaction / comment / pdf / embed_submit) ÷ sessions with `view` (%).

**Views over time** — daily `view` trend (reuse `TrendChart`); a small toggle to plot **completions** instead.

**Read funnel** (session-based, monotonic bars)
Viewed → Started walkthrough (`walkthrough_start`) → Completed (`complete`) → Engaged. Each bar shows count + % of Viewed.

**Walkthrough step drop-off** — for each step index *i*, distinct sessions that reached ≥ *i* (`walkthrough_step.context.stepIndex`), rendered as a descending horizontal bar chart. Surfaces the step where readers bail.

**Engagement breakdown**
- Reactions (from `GuideReaction`, range-filtered) with the existing per-emoji split.
- Comments (`GuideComment`, range-filtered).
- PDF downloads (`pdf_download`).
- Embedded-form conversions (`embed_submit`, per `context.formId`) — "N readers submitted _Feedback form_".

**Top languages** — `language_switch` grouped by `context.language`, plus the implicit base language, as a share bar.

**Mode split** — sessions that read as **Walkthrough** vs **Scroll**, from `mode_switch` / `walkthrough_start` and the guide's default view.

**Traffic sources** — `view` grouped by `context.referrerHost` ("Direct / tacto.so / notion.so / …"), top N.

---

## 4. Data model — `GuideEvent` (`packages/db/prisma/schema.prisma`)

One append-only table. Small rows, no PII, cascade-deleted with the guide. Mirrors the "cheap denormalized counter + rich event rows for time-series" split that Forms uses (`Form.viewCount` + `FormSubmission`).

```prisma
enum GuideEventType {
  VIEW               // reader opened the guide (one per session; deduped client-side)
  WALKTHROUGH_START  // entered interactive/walkthrough mode
  WALKTHROUGH_STEP   // reached a walkthrough step  (context.stepIndex; one per session+step)
  COMPLETE           // reached the end (last step in either mode)
  PDF_DOWNLOAD
  LANGUAGE_SWITCH    // context.language
  MODE_SWITCH        // context.mode = "list" | "interactive"
  EMBED_OPEN         // an embedded form overlay was shown  (context.formId)
  EMBED_SUBMIT       // an embedded form was submitted       (context.formId)
  SESSION_END        // pagehide/visibility flush; context.durationMs
}

/// Anonymous, append-only reader-engagement event for a published guide. The
/// source of truth for time-series + funnels. No PII: anonId is a localStorage
/// uuid, referrer is stored host-only. Rows cascade with the guide.
model GuideEvent {
  id        String         @id @default(uuid())
  guideId   String
  guide     Guide          @relation(fields: [guideId], references: [id], onDelete: Cascade)
  type      GuideEventType
  /// localStorage tacto_anon_id — groups a viewer across sessions. Null if blocked.
  anonId    String?
  /// Per page-load id — groups events into one viewing session (client-minted).
  sessionId String
  /// Event-specific bag: { stepIndex?, language?, mode?, formId?, durationMs?, referrerHost? }.
  context   Json?
  createdAt DateTime       @default(now())

  @@index([guideId, createdAt])
  @@index([guideId, type, createdAt])
  @@map("guide_event")
}
```

Add the back-relation `events GuideEvent[]` on `Guide`. Migration `add_guide_event` (enum + table + indexes; additive, no data change). `Guide.viewCount` is **retained** as a denormalized lifetime cache (kept in sync on `VIEW` inserts) so the library grid stays a single cheap read — everything else is derived from `GuideEvent`.

Reactions/comments are **not** duplicated into `GuideEvent`; they already have `createdAt` rows and are joined in the compute layer. Embedded-form conversions are captured **both** as a lightweight `EMBED_SUBMIT` guide event (for the funnel, indexed by guide) and remain a real `FormSubmission` (for the form's own results) — the guide event is the indexed, guide-scoped signal; §12 notes optionally promoting `FormSubmission.metadata.guideId` to a column later.

---

## 5. Event taxonomy & client capture

A small tracker `apps/web/lib/guide-tracker.ts`:

```ts
useGuideTracker(shareId): { track(type, context?) }
```

- Mints a per-page-load `sessionId` (`crypto.randomUUID()`), reads `anonId` (shared helper, extracted from `guide-feedback.tsx`), captures `referrerHost` once (`new URL(document.referrer).host` or `"direct"`).
- `track()` pushes `{ type, context, at }` into an in-memory queue; flushes via **`navigator.sendBeacon`** (falls back to `fetch(..., {keepalive:true})`) on a short debounce, on `visibilitychange → hidden`, and on `pagehide`. `session_end` (with `durationMs = now − mountedAt`) is emitted on the final flush. Batching keeps it to ~1–3 network calls per session.
- **Dedup is client-side**: `view` fires once per session; each `walkthrough_step` index fires once per session (a `Set`); `complete` once. The server only validates + rate-limits.

**Wiring (all in the public reader):**

| Event | Emitted from |
|---|---|
| `view`, `session_end` | `public-guide-view.tsx` (mount / unmount) |
| `mode_switch`, `walkthrough_start` | `public-guide-view.tsx` `ViewModeToggle` + default-mode resolution |
| `walkthrough_step`, `complete` | `interactive-view.tsx` (index change; last index) + list-mode `IntersectionObserver` on the final step for scroll completion |
| `pdf_download` | `public-guide-view.tsx` PDF button |
| `language_switch` | `LanguageSwitcher` |
| `embed_open`, `embed_submit` | `form-embed-overlay.tsx` (shown) + `PublicFormView onComplete` |

All wiring is **additive** — the tracker calls sit alongside existing handlers; if the beacon fails, the reader is unaffected (fire-and-forget).

---

## 6. Contracts (`packages/contracts/src/guide-analytics.ts`)

```ts
export const guideEventTypeSchema = z.enum([
  "view","walkthrough_start","walkthrough_step","complete","pdf_download",
  "language_switch","mode_switch","embed_open","embed_submit","session_end",
]);

export const guideEventContextSchema = z.object({
  stepIndex:    z.number().int().min(0).max(1000).optional(),
  language:     z.string().max(16).optional(),
  mode:         z.enum(["list","interactive"]).optional(),
  formId:       z.string().max(64).optional(),
  durationMs:   z.number().int().min(0).max(86_400_000).optional(),
  referrerHost: z.string().max(128).optional(),
}).strict();

// Batched beacon body — one session's events.
export const ingestGuideEventsSchema = z.object({
  anonId:    z.string().max(64).nullable(),
  sessionId: z.string().min(8).max(64),
  events: z.array(z.object({
    type:    guideEventTypeSchema,
    context: guideEventContextSchema.optional(),
  })).min(1).max(50),        // cap batch size
});

export const analyticsRangeSchema = z.enum(["7d","30d","90d"]);
export type GuideAnalytics = { /* see §8 */ };
```

The owner-facing `GuideAnalytics` result type lives here too and is imported by both the API and web hook (single source of truth, mirroring `FormAnalytics`).

---

## 7. Public ingestion — `POST /api/public/guides/:shareId/events`

In `apps/api/src/features/public/router.ts` (no-auth), mirroring the Forms `/start` beacon + submission rate-limit:

- Resolve `shareId → guide.id` (published only; 404 otherwise). Cache the mapping briefly to avoid a lookup per beacon.
- **Rate-limit** by IP+shareId via the existing `lib/rate-limit.ts` (e.g. 60 beacons / 60s — batching makes this generous).
- Validate with `ingestGuideEventsSchema`. Drop unknown fields (`.strict`). Ignore an event referencing a `formId`/`stepIndex` that doesn't belong to the guide (defensive, cheap).
- `prisma.guideEvent.createMany(...)` for the batch; if the batch contains a `view`, `prisma.guide.update({ viewCount: { increment: 1 } })` (bounded to one per batch to preserve the denormalized total's meaning). All **fire-and-forget** (`void ….catch(()=>{})`) — never block the beacon response; return `204`.

Server never trusts client timestamps for ordering — `createdAt` is `now()` at insert (batches flush within seconds, well within a day bucket). If sub-minute ordering ever matters we add an optional client `at` offset; not needed for daily analytics.

---

## 8. Aggregation + owner API

**Pure module** `apps/api/src/features/guide/analytics.ts` (unit-tested, no DB/Prisma imports — takes plain rows), directly modeled on `form/results.ts`:

```ts
type EventRow    = { type: GuideEventType; anonId: string | null; sessionId: string; context: Ctx; createdAt: Date };
type EngagementRow = { createdAt: Date };  // reactions / comments

computeGuideAnalytics(events, reactions, comments, days, now): GuideAnalytics
```

Returns (all range-scoped; totals derived from the **same rows** as the trend, so headline numbers and the chart never disagree — a caveat we're fixing from the Forms version, where cards are lifetime and only the trend is ranged):

```ts
type GuideAnalytics = {
  range: "7d" | "30d" | "90d";
  totals: { views: number; uniqueViewers: number; avgTimeMs: number | null;
            completionRate: number; engagementRate: number };
  trend: { date: string; views: number; completions: number }[];   // zero-filled, UTC day buckets
  funnel: { viewed: number; started: number; completed: number; engaged: number };  // session counts
  stepDropoff: { step: number; sessions: number }[];               // sessions reaching ≥ step
  engagement: { reactions: number; comments: number; pdfDownloads: number; formSubmits: number;
                reactionsByEmoji: { emoji: string; count: number }[] };
  languages: { language: string; sessions: number }[];             // top, desc
  modes: { list: number; interactive: number };                    // sessions
  sources: { host: string; views: number }[];                      // top N, desc
};
```

Reuses the Forms **`dayKey` + contiguous zero-fill** trend algorithm (`results.ts:21-58`) verbatim. Pure ⇒ a `analytics.test.ts` pins funnel monotonicity, zero-fill length, dedup-by-session counts, and completion/engagement math (mirrors `results.test.ts`).

**Endpoint** — replace the stub `GET /api/guides/:id/analytics` (`guide/router.ts:689`) with `range`-aware behavior (auth + workspace scoped, matching Forms):
- Parse `range` (default `30d`) → `days`.
- Load `guideEvent` where `createdAt >= since`, plus `guideReaction`/`guideComment` where `createdAt >= since` (both already indexed by guide/createdAt).
- Return `computeGuideAnalytics(...)`. (Also expose `guide.viewCount` lifetime + `publishedAt` in the payload for a "since published" footnote.)
- Optional `GET …/analytics/export` → CSV of the daily trend rows (reuse the Forms CSV response pattern) — foldable into a later phase.

---

## 9. Web — the Analytics page

A **dedicated route** `apps/web/app/(app)/guides/[id]/analytics/page.tsx` (sibling of `/guides/[id]/edit`), replacing the current dialog. The `⋯ → Analytics` menu item (`guides/[id]/page.tsx:448`) becomes a `Link` to it; the old dialog (`:314`) is removed.

- **Chrome:** `useSetNavbar` with a Back button → `/guides/{id}`, title "Analytics", and the range toggle as a right-side action (same primitives as the Forms detail page and the guide editor navbar).
- **Data:** `useGuideAnalytics(guideId, range)` in `apps/web/lib/guides.ts` — `queryKey ["guide-analytics", guideId, range]`, GET `/guides/{id}/analytics?range=` (copy of `useFormAnalytics`).
- **Layout (top → bottom):**
  1. **Stat cards** — Views · Unique viewers · Avg. time · Completion rate · Engagement rate (the Forms `grid` + `tabular-nums` card style, `formatMs` helper reused).
  2. **Views over time** — `<TrendChart>` with a Views/Completions segmented toggle.
  3. **Read funnel** — horizontal bars (Viewed → Started → Completed → Engaged), % of Viewed.
  4. **Walkthrough drop-off** — descending step bars (hidden if the guide has no walkthrough usage in range).
  5. **Engagement** — small cards: reactions (+ emoji chips), comments, PDF downloads, form conversions.
  6. **Languages · Mode split · Sources** — three compact share/list widgets.
- **States:** `animate-pulse` skeletons while pending; a friendly empty state ("No reads yet — share your guide to start seeing analytics") when `totals.views === 0`; unpublished guides show "Publish this guide to collect analytics."

**Reuse / refactor:**
- **`TrendChart`** moves from `apps/web/components/form-builder/trend-chart.tsx` → `apps/web/components/analytics/trend-chart.tsx` (parameterize the hardcoded `aria-label`), re-imported by the Forms page. Pure move; no behavior change.
- Stat-card grid, range-toggle, and `formatMs` are lifted into small shared bits under `components/analytics/` so Forms and Guides share one implementation.
- New, guide-specific presentational components: `FunnelBars`, `StepDropoffChart`, `ShareList` (languages/sources), `ModeSplit` — all dependency-free SVG/flex, matching the hand-rolled `TrendChart` aesthetic (no chart library).

---

## 10. Privacy

Anonymous by construction: the only identifier is the existing `localStorage` `anonId` (no new cookies, no IP stored, no PII in `context`). Referrer is reduced to a host. The public reader already mints `anonId` for reactions; this reuses it. A future "Do Not Track / cookieless" mode can skip `anonId` (events still counted as sessions). No third-party analytics SDKs.

---

## 11. One deliberate behavior change (called out)

Today every server-side GET of a published guide blind-increments `viewCount` (`public/router.ts:95`) — bots, prefetches, and reloads all count. We **move view-counting to the client `view` beacon** (deduped per session, attributable to `anonId`/referrer) and **remove the blind server increment**. Net effect: `viewCount` becomes more accurate (deduped, human) but numbers will be **lower than the old inflated counter** — a one-time discontinuity to note in the changelog. `Guide.viewCount` remains the denormalized lifetime total, now fed by `view` events.

---

## 12. Scale & retention (design now, build later)

`GuideEvent` is the only unbounded table introduced. At current scale (single workspace, thousands of reads) the two composite indexes make range queries trivial. Before this grows:
- **Daily rollup** — a `GuideDailyStat` table (`guideId, day, views, uniques, completions, …`) populated by a worker cron, so long ranges read O(days) not O(events); raw events kept ~90–180d for drill-down, then pruned. Sketched here, **not built in v1**.
- **Batch inserts** already cap write amplification (one `createMany` per session flush).

---

## 13. Phasing

Each phase compiles, lints, tests, and ships independently; nothing is user-visible until Phase C.

- **Phase A — Capture.** `GuideEvent` schema + migration; `guide-analytics` contracts; public `/events` beacon (+ rate-limit); `guide-tracker.ts` + shared `useAnonId`; wire the reader (`public-guide-view`, `interactive-view`, `guide-feedback` reuse, `form-embed-overlay`); switch view-counting to the beacon (§11). *Ships: events flow; no UI.*
- **Phase B — Aggregate + API.** Pure `analytics.ts` + `analytics.test.ts`; replace the `/analytics` stub with the range-aware endpoint. *Ships: real API, tested.*
- **Phase C — Page.** `/guides/[id]/analytics` route; `useGuideAnalytics`; move/parameterize `TrendChart`; build the page + widgets; swap the menu dialog for a link. *Ships: the analytics page.*
- **Phase D — Polish (optional/foldable).** CSV export of daily rows; indexed embedded-form attribution; empty/first-run coaching. *Ships: extras.*

---

## 14. Verification

1. Open a published guide as an anonymous viewer, switch to walkthrough, reach step 3, download the PDF, react — confirm `GuideEvent` rows (deduped: one `view`, one `walkthrough_step` per step, one `pdf_download`) and a `session_end` with `durationMs` on tab close.
2. Reopen in a second "session" (new tab) — `views` = 2, `uniqueViewers` = 1.
3. Analytics page: stat cards, trend (Views + Completions toggle), funnel monotonic (viewed ≥ started ≥ completed ≥ engaged), step drop-off descending, engagement counts match the reaction/comment/PDF actions, language + source + mode widgets populate; range toggle re-queries.
4. `analytics.test.ts` green (funnel/dedup/zero-fill/rate math).
5. Unpublished guide → "Publish to collect analytics"; zero-traffic guide → empty state.
6. `viewCount` no longer double-increments on reload; changelog notes the discontinuity.
7. `turbo build typecheck lint` + api/db tests green; Forms analytics unaffected by the `TrendChart` move.

---

## 15. Open questions

1. **Completion in scroll mode** — define as "final step enters viewport" (IntersectionObserver). Good enough, or require dwell time? *Proposed: viewport-enter, no dwell (v1).*
2. **Bot traffic** — count only `sendBeacon`-capable, visible sessions? A UA denylist? *Proposed: rely on client beacon (bots rarely run JS); revisit if numbers look inflated.*
3. **Reactions/comments range basis** — count by their own `createdAt` (independent of a matching `view`)? *Proposed: yes — engagement is real regardless of whether we logged that viewer's `view`.*
4. **Embedded-form conversions** — is the `embed_submit` guide event sufficient, or do we need indexed `FormSubmission.metadata.guideId` now? *Proposed: guide event for v1; promote to a column in Phase D if per-form drill-down is wanted.*
5. **Retention window** for raw `GuideEvent` before the rollup lands. *Proposed: unbounded in v1; add rollup + 180d prune when volume warrants (§12).*
