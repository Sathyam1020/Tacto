# Phase 12 — Guide Analytics — Implementation Plan

**Status:** Shipped (all 5 phases) · **Source of truth for build** · Companion to `phase-12-guide-analytics-rfc.md`
**Branch:** `feat/guide-analytics` · **Scope:** `apps/web`, `apps/api`, `packages/{contracts,db,ui}` — **Guides only**

> Convention note: this lives in `docs/plans/` next to the RFC and `phase-11-forms-implementation-plan.md` (the established location for phase plans).

---

## 0. Approved refinements (fold into every phase)

1. **`GuideEvent.context` future-proofing** — in addition to the RFC fields (`stepIndex`, `language`, `mode`, `formId`, `durationMs`, `referrerHost`), the context schema **also** carries: `guideVersion`, `deviceType`, `browser`, `utmSource`, `utmMedium`, `utmCampaign`. Stored only — **not surfaced in the UI** in this phase set. All optional.
2. **Completion definition** (avoid inflated rates from fast scroll-to-bottom):
   - **Interactive mode** — `complete` fires when the reader reaches the **final walkthrough step**.
   - **Scroll mode** — `complete` fires only when the reader has actually **viewed ≥ 80% of the guide's steps AND viewed the final step**. Tracked client-side via a per-session `Set<stepIndex>` populated by an `IntersectionObserver` on each step block; `complete` is emitted once when `viewed.size / totalSteps ≥ 0.8 && viewed.has(lastIndex)`.
3. **`SESSION_END` is best-effort** — every metric except **Avg. time** must be correct without it. `avgTimeMs` is computed only from sessions that produced a `session_end` (`durationMs`), and is `null` when none exist. Abrupt closes/crashes degrade gracefully (we lose only that session's duration, nothing else).

---

## 1. Overall roadmap

The spine is a single append-only **`GuideEvent`** table. A batched `sendBeacon` client tracker feeds a no-auth ingestion endpoint; a pure, unit-tested aggregation module powers an owner API; a dedicated page renders it, reusing the Forms analytics visual language and the hand-rolled `TrendChart` (moved to a shared location — no chart library, no new deps).

```
Reader (public)                 API                         Owner (app)
─────────────────────────       ─────────────────────       ──────────────────────
guide-tracker.ts  ──beacon──►   POST /public/guides/        computeGuideAnalytics()
 (view, steps,                   :shareId/events    ──►      (pure, tested)
  complete, pdf,                 → GuideEvent rows                 ▲
  lang, mode,                    → viewCount cache                 │
  embed, session_end)                                       GET /guides/:id/
                                                             analytics?range=  ──►  /guides/[id]/analytics
```

---

## 2. Phases (build order, each independently shippable)

### Phase 1 — Database + Contracts
- `packages/db/prisma/schema.prisma`: `enum GuideEventType`, `model GuideEvent`, back-relation `events GuideEvent[]` on `Guide`.
- Migration `add_guide_event` (enum + table + two composite indexes; additive, no data change).
- `prisma generate`.
- `packages/contracts/src/guide-analytics.ts`: `guideEventTypeSchema`, `guideEventContextSchema` (incl. refinement #1 fields), `ingestGuideEventsSchema`, `analyticsRangeSchema`, and the `GuideAnalytics` result type. Export via `package.json` subpath if needed (mirror `@workspace/contracts/form`).
- **Gate:** `turbo build typecheck lint` green; db test (`schema-draft`) green. Commit.

### Phase 2 — Ingestion + Reader instrumentation
- `apps/api/src/features/public/router.ts`: `POST /api/public/guides/:shareId/events` — resolve shareId→guide (published only), rate-limit (existing `lib/rate-limit.ts`), validate, `createMany`, bump `viewCount` once per batch containing a `view`. Fire-and-forget, `204`.
- **Remove** the blind server-side `viewCount` increment on the guide GET (`public/router.ts:95`) — view-counting moves to the deduped client `view` beacon (RFC §11; changelog note).
- `apps/web/lib/anon-id.ts`: extract the shared `useAnonId` (currently duplicated in `guide-feedback.tsx` + `public-form-view.tsx`); repoint both.
- `apps/web/lib/guide-tracker.ts`: `useGuideTracker(shareId)` → `{ track(type, context?) }`. Mints `sessionId`, reads `anonId`, captures `referrerHost` + `deviceType` + `browser` + `utm*` once, queues events, flushes via `sendBeacon` (debounced + on `visibilitychange:hidden` + `pagehide`), emits `session_end` with `durationMs` on final flush. Dedup (`view` once, each `walkthrough_step` once, `complete` once) via in-memory `Set`s.
- Reader wiring (additive):
  - `public-guide-view.tsx` — `view` (mount), `session_end` (unmount), `mode_switch`, `walkthrough_start`, `pdf_download`, `language_switch`; scroll-mode completion via per-step `IntersectionObserver` + 80%-rule.
  - `interactive-view.tsx` — `walkthrough_step` per step reached; `complete` on final step.
  - `form-embed-overlay.tsx` — `embed_open`; `embed_submit` via `PublicFormView onComplete`.
- **Gate:** build/typecheck/lint green; manual: events land in DB, dedup holds, no double view. Commit.

### Phase 3 — Aggregation + Owner API + tests
- `apps/api/src/features/guide/analytics.ts` (pure, no Prisma): `computeGuideAnalytics(events, reactions, comments, days, now): GuideAnalytics`. Reuse the Forms `dayKey` + contiguous zero-fill trend algorithm.
- `apps/api/src/features/guide/analytics.test.ts`: funnel monotonicity, session-dedup counts, zero-fill length, completion/engagement math, `avgTimeMs === null` when no `session_end`. Add to `apps/api` `test` script.
- Replace the stub `GET /api/guides/:id/analytics` (`guide/router.ts:689`) with the range-aware endpoint (auth + workspace scoped, `range` default `30d`).
- **Gate:** api tests green; build/typecheck/lint green. Commit.

### Phase 4 — Analytics page
- Move `apps/web/components/form-builder/trend-chart.tsx` → `apps/web/components/analytics/trend-chart.tsx` (parameterize `aria-label`); repoint the Forms import. Pure move.
- Shared bits under `components/analytics/`: `StatCard`/grid, `RangeToggle`, `formatMs`.
- New guide-specific presentational components (dependency-free SVG/flex): `FunnelBars`, `StepDropoffChart`, `ShareList` (languages + sources), `ModeSplit`, engagement cards.
- `apps/web/lib/guides.ts`: `useGuideAnalytics(guideId, range)` (copy `useFormAnalytics`).
- Route `apps/web/app/(app)/guides/[id]/analytics/page.tsx` — navbar Back→`/guides/{id}` + title + range toggle; sections per RFC §9; skeletons + empty/unpublished states.
- Replace the `⋯ → Analytics` dialog (`guides/[id]/page.tsx:314`) with a `Link` to the route.
- **Gate:** build/typecheck/lint green; Forms analytics unaffected by the `TrendChart` move. Commit.

### Phase 5 — Polish
- CSV export of the daily trend (`GET …/analytics/export`, reuse Forms CSV response pattern) + button.
- Empty/first-run/unpublished coaching states; loading polish.
- Performance review (index usage; batch sizes; query shapes).
- Update `phase-12-guide-analytics-rfc.md` status → Shipped; changelog note on the view-count discontinuity.
- **Gate:** full `turbo build typecheck lint` + api/db tests green. Commit.

---

## 3. Database changes (Phase 1)

```prisma
enum GuideEventType {
  VIEW
  WALKTHROUGH_START
  WALKTHROUGH_STEP
  COMPLETE
  PDF_DOWNLOAD
  LANGUAGE_SWITCH
  MODE_SWITCH
  EMBED_OPEN
  EMBED_SUBMIT
  SESSION_END
}

model GuideEvent {
  id        String         @id @default(uuid())
  guideId   String
  guide     Guide          @relation(fields: [guideId], references: [id], onDelete: Cascade)
  type      GuideEventType
  anonId    String?
  sessionId String
  context   Json?
  createdAt DateTime       @default(now())

  @@index([guideId, createdAt])
  @@index([guideId, type, createdAt])
  @@map("guide_event")
}
```
- `Guide` gains `events GuideEvent[]`.
- `Guide.viewCount` retained (denormalized lifetime cache, now fed by `view` events).
- Migration: `packages/db` → `prisma migrate dev --create-only --name add_guide_event`, review SQL (pure additive), `prisma migrate deploy`, `prisma generate`.

---

## 4. Contracts (Phase 1) — `packages/contracts/src/guide-analytics.ts`

```ts
export const guideEventTypeSchema = z.enum([
  "view","walkthrough_start","walkthrough_step","complete","pdf_download",
  "language_switch","mode_switch","embed_open","embed_submit","session_end",
]);

export const guideEventContextSchema = z.object({
  // RFC fields
  stepIndex:    z.number().int().min(0).max(1000).optional(),
  language:     z.string().max(16).optional(),
  mode:         z.enum(["list","interactive"]).optional(),
  formId:       z.string().max(64).optional(),
  durationMs:   z.number().int().min(0).max(86_400_000).optional(),
  referrerHost: z.string().max(128).optional(),
  // Refinement #1 — future-proof (stored, not surfaced)
  guideVersion: z.number().int().optional(),
  deviceType:   z.enum(["mobile","tablet","desktop"]).optional(),
  browser:      z.string().max(32).optional(),
  utmSource:    z.string().max(128).optional(),
  utmMedium:    z.string().max(128).optional(),
  utmCampaign:  z.string().max(128).optional(),
}).strict();

export const ingestGuideEventsSchema = z.object({
  anonId:    z.string().max(64).nullable(),
  sessionId: z.string().min(8).max(64),
  events: z.array(z.object({
    type:    guideEventTypeSchema,
    context: guideEventContextSchema.optional(),
  })).min(1).max(50),
});

export const analyticsRangeSchema = z.enum(["7d","30d","90d"]);

export type GuideAnalytics = {
  range: "7d" | "30d" | "90d";
  totals: { views: number; uniqueViewers: number; avgTimeMs: number | null;
            completionRate: number; engagementRate: number };
  trend: { date: string; views: number; completions: number }[];
  funnel: { viewed: number; started: number; completed: number; engaged: number };
  stepDropoff: { step: number; sessions: number }[];
  engagement: { reactions: number; comments: number; pdfDownloads: number; formSubmits: number;
                reactionsByEmoji: { emoji: string; count: number }[] };
  languages: { language: string; sessions: number }[];
  modes: { list: number; interactive: number };
  sources: { host: string; views: number }[];
};
```

---

## 5. APIs

| Method | Path | Auth | Phase | Notes |
|---|---|---|---|---|
| POST | `/api/public/guides/:shareId/events` | none | 2 | batched beacon; rate-limited; `204` |
| GET | `/api/guides/:id/analytics?range=` | auth+ws | 3 | replaces stub; returns `GuideAnalytics` (+ lifetime `viewCount`, `publishedAt`) |
| GET | `/api/guides/:id/analytics/export?range=` | auth+ws | 5 | CSV of daily trend |

---

## 6. Frontend work

- **Tracker/util:** `lib/anon-id.ts` (extracted), `lib/guide-tracker.ts` (new).
- **Instrumentation:** `public-guide-view.tsx`, `interactive-view.tsx`, `form-embed-overlay.tsx` (additive calls only).
- **Shared analytics UI:** `components/analytics/trend-chart.tsx` (moved), `stat-card.tsx`, `range-toggle.tsx`, `format.ts` (`formatMs`).
- **Guide widgets:** `funnel-bars.tsx`, `step-dropoff-chart.tsx`, `share-list.tsx`, `mode-split.tsx`.
- **Page:** `app/(app)/guides/[id]/analytics/page.tsx`; hook `useGuideAnalytics`; menu link swap in `guides/[id]/page.tsx`.

---

## 7. Event flow (client dedup + completion rules)

- Mount → `view` (once). Capture `referrerHost/deviceType/browser/utm*` once.
- Mode toggle → `mode_switch`; entering interactive → `walkthrough_start` (once).
- Interactive step reached → `walkthrough_step {stepIndex}` (once per step); final step → `complete` (once).
- Scroll mode → per-step `IntersectionObserver` builds `viewed:Set`; when `viewed.size/total ≥ 0.8 && viewed.has(last)` → `complete` (once). (No per-step events emitted in scroll mode — keeps volume low; drop-off is walkthrough-scoped.)
- PDF button → `pdf_download`; language switch → `language_switch {language}`.
- Embed shown → `embed_open {formId}`; embed submitted → `embed_submit {formId}`.
- `visibilitychange:hidden` / `pagehide` → final flush + `session_end {durationMs}` (best-effort).

---

## 8. Testing strategy

- **Unit (Phase 3):** `analytics.test.ts` — pure `computeGuideAnalytics` over synthetic rows. Assert: trend zero-fill length = `days`, views/completions per bucket; funnel monotonic + session-deduped; `uniqueViewers` distinct-anon; `completionRate`/`engagementRate` math; `stepDropoff` descending; `avgTimeMs === null` with no `session_end`, correct mean with some. Hand-rolled `test()` + `node:assert/strict` (matches `results.test.ts`).
- **Contract sanity:** `ingestGuideEventsSchema` rejects oversized batches / unknown context keys (`.strict`).
- **Per phase:** `turbo build typecheck lint` + `apps/api` `npm test` + `packages/db` `npm test`.
- **Manual E2E (Phase 2/4):** read a published guide (both modes), verify DB rows + dedup + no double view; verify the page renders funnel/trend/drop-off/engagement and the range toggle re-queries.

---

## 9. Rollout order & commits

1. Phase 1 → commit `feat(analytics): GuideEvent schema, migration, contracts`.
2. Phase 2 → commit `feat(analytics): public event ingestion + reader tracker`.
3. Phase 3 → commit `feat(analytics): aggregation engine + owner API + tests`.
4. Phase 4 → commit `feat(analytics): guide analytics page + shared TrendChart`.
5. Phase 5 → commit `feat(analytics): CSV export, empty states, polish`.

Each commit is independently green (build/typecheck/lint/tests). No changes to unrelated code. No new runtime dependencies. No chart libraries.
