# Tacto — Phase 3: Data-model spine + AI pipeline (fake input)

## Context

Phases 1–2 shipped auth, workspaces, and the app shell. Phase 3 builds what Tacto actually *is*: the **capture → guide data model** and the **processing pipeline** that turns an event log into an AI-written guide. Deliberately fed with **hand-written fixture events** (no extension yet) — this proves the company's core bet (AI writes good documentation from click data) in days, and isolates pipeline quality from capture quality. When the extension ships (Phase 4), it plugs into this exact pipeline.

Research findings (verified today):
- **AI SDK is v7** — `generateObject` is gone; structured output is `generateText` + `Output.object({ schema })` (zod). Providers as instances: `openai('…')` / `anthropic('…')` (@ai-sdk/openai@4, @ai-sdk/anthropic@4).
- **BullMQ 5.79 + ioredis 5.11**; user's local **Redis 8.6.3 verified running** (Homebrew, PONG) → `redis://localhost:6379`.
- **OpenAI is the starting provider** (user supplied a fresh key, $5 credit — ample: text-only synthesis costs well under 1¢/run on a mini-tier model). The AI layer is provider-agnostic; Anthropic is wired but dormant until a key exists.

## What gets built

### 1. Schema — the product spine (`packages/db`)
Migration `add-captures-guides`. All rows workspace-scoped via `organizationId`; UUIDs; `createdAt/updatedAt`; **soft deletes** (`deletedAt`) on Capture & Guide.

- **Capture** — immutable raw material: `organizationId`, `createdById`, `source` enum (`EXTENSION | VIDEO_UPLOAD | IMPORT`), `status` enum (`UPLOADING | PROCESSING | READY | FAILED`), `title?`, `events Json` (normalized event log — inline JSONB for MVP; R2 offload when events carry screenshots), `errorMessage?`
- **Guide** — the editable derivative: `organizationId`, `captureId?`, `createdById`, `title`, `summary?`, `status` enum (`DRAFT | PUBLISHED`)
- **Step** — `guideId`, `position`, `instruction` (text), `elementLabel?`, `url?`, `screenshotUrl?` (null this phase), `boundingBox Json?`, `confidence?`
- Indexes: `organizationId` everywhere, `guideId+position`

Deferred by design: KnowledgeSpace (flat library for MVP — nullable FK later is a trivial migration), Output table (publish phase).

### 2. Contracts — the crown-jewel event schema (`packages/contracts`)
`src/capture.ts`: `captureEventSchema` — discriminated union of `click | input | navigation` events with `timestamp`, `url`, `pageTitle`, `target {selector?, role?, text, boundingBox?, nearbyContext?}`, `value?` (inputs, pre-masked), `confidence?`. Plus `createCaptureSchema` (title?, source, events[]), guide/step output schemas, and **queue constants** (`CAPTURE_QUEUE`, job payload type) so api and worker share one definition without a new package.

### 3. AI layer — provider-agnostic (`packages/ai`, new)
- `src/model.ts`: `getModel()` — reads `AI_PROVIDER` (`openai | anthropic`, default openai) + `AI_MODEL` env; returns a provider instance. Swapping providers = one env line, per the founding brief.
- `src/synthesize-guide.ts`: `synthesizeGuide(events, context) → { title, summary, steps[] }` via `generateText` + `Output.object` (zod schema shared with contracts). The prompt: ordered action log → imperative step instructions, merge trivial actions, flag mistakes/backtracking, never invent actions. **This file is the company's core IP — prompt iteration happens here.**
- Deps: `ai@^7`, `@ai-sdk/openai@^4`, `@ai-sdk/anthropic@^4`, zod.

### 4. Worker — the pipeline (`apps/worker`, new)
BullMQ `Worker` on `CAPTURE_QUEUE`, stages as pure functions (`src/pipeline/`):
1. **normalize** — order events, coalesce keystroke runs into one input event, drop noise (body clicks, focus churn)
2. **segment** — group into step candidates (navigation events become boundaries)
3. **synthesize** — `packages/ai` call
4. **assemble** — transactionally write Guide + Steps, mark Capture `READY`
Failure path: mark Capture `FAILED` + `errorMessage`; BullMQ retry (2 attempts, backoff). Graceful shutdown. Same env pattern as api (zod-validated; needs `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`). `tsx watch` dev, wired into turbo `dev`.

### 5. API — capture + guide features (`apps/api`)
- `features/capture/`: `POST /api/captures` (requireAuth+requireWorkspace; body = `createCaptureSchema`; creates Capture PROCESSING + enqueues job), `GET /api/captures/:id` (status polling)
- `features/guide/`: `GET /api/guides` (workspace list, newest first, excludes soft-deleted), `GET /api/guides/:id` (with ordered steps)
- `lib/queue.ts`: BullMQ `Queue` instance (ioredis connection from `REDIS_URL`)

### 6. Web — the library becomes real (`apps/web`)
- `/library`: react-query list from `/api/guides` — the editorial index rows from the design system (StepMarker, serif titles, mono metadata: `N steps · date`); empty state stays for zero guides; capture in `PROCESSING` shows a TouchRing `processing` row that polls
- `/guides/[id]` (in `(app)`): read-only guide view — serif title, numbered steps with instructions + mono `elementLabel`/`url` metadata. The editor comes later; this proves the payoff visually.

### 7. Fixture + seed — the fake capture
- `fixtures/stripe-onboarding.json` (in apps/worker): ~15 realistic hand-written events (navigate to customers → click New customer → fill email → save…)
- `apps/api` script `npm run seed:capture`: POSTs the fixture through the real endpoint (real auth cookie via env or direct service call) so the entire chain is exercised, not shortcut

### 8. Env + wiring
- `apps/api/.env` += `REDIS_URL=redis://localhost:6379`, `OPENAI_API_KEY` (user's key), optional `AI_PROVIDER`/`AI_MODEL`
- `apps/worker/.env` = DATABASE_URL, REDIS_URL, OPENAI_API_KEY, AI_PROVIDER/AI_MODEL
- turbo `globalEnv` += `REDIS_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AI_PROVIDER`, `AI_MODEL`
- Exact current OpenAI mini-tier model id verified against provider docs at implementation time; set via `AI_MODEL` env so it's data, not code
- Plan copied to `docs/plans/phase-03-pipeline-spine.md` (step 1, per repo convention)

## Order of implementation
1. docs/plans copy → 2. schema + migration → 3. contracts (events, queue) → 4. packages/ai → 5. worker pipeline → 6. api features + queue → 7. web library + guide view → 8. fixture + seed → 9. verify

## Verification (end-to-end)
1. `npm run dev` (api + worker + web), Redis PONG
2. Seed the Stripe fixture capture → worker log shows normalize → segment → synthesize → assemble
3. DB: Capture `READY`; Guide + ordered Steps rows exist (Prisma Studio)
4. `GET /api/guides` returns it; cross-workspace check: second workspace sees empty list (scoping proof)
5. `/library` shows the guide row; click → `/guides/[id]` renders AI-written steps — **the first end-to-end Tacto guide**
6. Failure path: seed with `OPENAI_API_KEY` broken in worker → Capture `FAILED` + errorMessage, no orphan Guide
7. Prompt-quality gate (founder eyeball): steps must be imperative, accurate to the fixture, no hallucinated actions — iterate the prompt until good
8. `turbo typecheck && lint && build` green

## Out of scope (this phase)
Chrome extension, screenshots/annotation, R2, video upload, guide editor (read-only view only), publishing/outputs, knowledge spaces, realtime progress via websockets (polling only).
