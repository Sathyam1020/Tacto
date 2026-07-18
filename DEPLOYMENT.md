# Tacto — Production Deployment

> Everything a new engineer needs to deploy the entire stack from zero, without
> asking anyone. It reflects **this repository** as it is — where something isn't
> wired yet (transactional email, error tracking), that's called out, not faked.

**Stack at a glance:** Turborepo monorepo · Next.js 16 (web) · Express 5 + `tsx`
(api) · BullMQ (worker) · WXT (extension) · Neon Postgres · Upstash/Railway
Redis · Cloudflare R2 · OpenAI + ElevenLabs. Hosts: **Vercel** (web) and
**Railway** (api + worker + Redis). Deploys are **provider-native on merge to
`main`**; GitHub Actions is the CI gate.

---

## Table of contents

1. [Architecture](#1-architecture)
2. [Applications](#2-applications)
3. [Production services](#3-production-services)
4. [Environment variables](#4-environment-variables)
5. [First production deployment](#5-first-production-deployment)
6. [Updating production](#6-updating-production)
7. [Rollback strategy](#7-rollback-strategy)
8. [Database](#8-database)
9. [Worker & queues](#9-worker--queues)
10. [Storage](#10-storage)
11. [Monitoring](#11-monitoring)
12. [Security](#12-security)
13. [CI/CD](#13-cicd)
14. [Disaster recovery](#14-disaster-recovery)
15. [Production checklist](#15-production-checklist)
16. [Future scaling](#16-future-scaling)

---

## 1. Architecture

```
                          Developer
                             │  git push / PR
                             ▼
                          GitHub ──────────────► GitHub Actions (CI gate)
                             │  merge → main       typecheck · lint · build · test
              ┌──────────────┴───────────────┐
              │ auto-deploy                   │ auto-deploy
              ▼                               ▼
        ┌───────────┐                 ┌──────────────────────────────┐
        │  Vercel   │                 │           Railway            │
        │   web     │                 │  ┌────────┐      ┌─────────┐  │
        │ tacto.fyi │                 │  │  api   │      │ worker  │  │
        └─────┬─────┘                 │  │Express │      │ BullMQ  │  │
              │ browser hits          │  └───┬────┘      └────┬────┘  │
              │ tacto.fyi/api/*       │      │ enqueue        │ consume
              │  ──rewrite (SSR)──►   │      └──────┬─────────┘       │
              │   api.tacto.fyi       │             ▼                 │
              │                       │          ┌───────┐            │
              │                       │          │ Redis │ (queues)   │
              │                       │          └───────┘            │
              │                       └──────────────────────────────┘
              │                              │            │
   Chrome extension ──(Bearer)──► api.tacto.fyi          │
   (WXT, Web Store)                    │                 │
                        ┌──────────────┼─────────────────┼───────────────┐
                        ▼              ▼                  ▼               ▼
                   Neon (Postgres)  Cloudflare R2   OpenAI / Anthropic  ElevenLabs
                   guides, users,   screenshots,    guide synthesis,    voiceover
                   forms, orgs…     exports, audio  FAQs, translation   audio (TTS)
```

### Who does what

| Component | Responsibility |
|---|---|
| **GitHub** | Source of truth. `main` is production. PRs run CI; merging triggers provider deploys. |
| **GitHub Actions** | CI gate only (no deploy): `turbo typecheck lint build` + web unit tests. Needs no secrets. |
| **Vercel — web** | Serves the Next.js frontend at `tacto.fyi`. SSR-renders public pages, proxies `/api/*` to the API (keeps auth cookies first-party), hosts the marketing site, dashboard, embeds, and public guide/help/showcase pages. |
| **Railway — api** | Express server. The **only** thing browsers/extension talk to for data + auth. Owns better-auth, all authenticated CRUD, public read APIs, presigned R2 uploads, and **enqueues** jobs. Holds no AI keys. |
| **Railway — worker** | BullMQ consumer. All slow/failure-prone work: capture→guide synthesis (AI), voiceover (ElevenLabs), translation, and video export (ffmpeg). Scales by running more instances. No HTTP surface. |
| **Railway — Redis** | BullMQ backing store: 4 queues (`capture`, `voice`, `translation`, `export`). API produces, worker consumes. |
| **Neon** | Serverless Postgres. Single source of durable state. Prisma is the client; migrations are forward-only. |
| **Cloudflare R2** | Object storage: capture screenshots, exported PDFs/MP4s, and generated voiceover audio. S3-compatible. |
| **OpenAI / Anthropic** | LLM for guide-step synthesis, FAQ generation, and translation. Provider is an env switch (`AI_PROVIDER`). Keys live **only in the worker**. |
| **ElevenLabs** | Text-to-speech for walkthrough voiceover. Used by the worker (synthesis) and optionally the API (editor previews). |
| **Chrome extension** | WXT-built recorder. Captures browser workflows and posts them to the API with a Bearer token. Shipped to the Chrome Web Store **manually** (not part of CI/CD). |

> **Not in this stack (yet):** PostHog (analytics is **first-party** — see §11),
> Resend / any email provider (invites are **link-based** — see §12), and any
> error-tracking service (Sentry — recommended in §11). Don't add env vars for
> services the code doesn't read.

---

## 2. Applications

Monorepo layout (Turborepo, npm workspaces):

```
apps/web      Next.js 16 frontend        → Vercel
apps/api      Express 5 API              → Railway (Docker)
apps/worker   BullMQ job consumer        → Railway (Docker)
apps/extension WXT Chrome extension      → Chrome Web Store (manual)
packages/*    contracts · db · ai · generation · storage · ui · configs
```

All services run **TypeScript directly via `tsx`** (api/worker) — there is no
JS compile step; `tsx` is a runtime dependency of the images. `apps/*/build`
scripts are `tsc --noEmit` (type-check only), so Turbo caches them but they emit
nothing.

| App | Purpose | Runtime | Target | Build command | Start command (prod) |
|---|---|---|---|---|---|
| **web** | Frontend: marketing site, dashboard, public guide/form/help/showcase pages, embeds. Proxies `/api/*` → API. | Node 22 / Next.js 16 | **Vercel** (Root Dir `apps/web`) | `next build` (Vercel auto) | `next start` (Vercel-managed) |
| **api** | Auth + all data CRUD + presigned uploads + job enqueue. | Node 22 / Express 5 via `tsx` | **Railway** (`apps/api/Dockerfile`) | Docker: `npm ci` → `npm run db:generate -w @workspace/db` | `npm run start:prod -w apps/api` → `tsx src/index.ts` |
| **worker** | Consumes 4 queues: capture, voice, translation, export. | Node 22 via `tsx` (+ ffmpeg-static, sharp) | **Railway** (`apps/worker/Dockerfile`) | same Docker build as api | `npm run start:prod -w apps/worker` → `tsx src/index.ts` |
| **extension** | Records browser workflows, sends to API with Bearer token. | WXT (Vite) | **Chrome Web Store** (manual upload) | `npm run build -w apps/extension` (with `WXT_*` env) | n/a (client-side) |

**Local dev (all services):**

```bash
npm install
npm run db:migrate -w @workspace/db     # apply migrations to your dev DB
npm run dev                              # web :3100 · api :4100 · worker
# Redis for local dev: docker run -p 6379:6379 redis
```

---

## 3. Production services

For each external dependency: **why**, **where used**, **required env**.

### Neon (Postgres)
- **Why:** the only durable store — users, workspaces (better-auth orgs), guides, blocks, forms, help centers, showcases, analytics events, media-render rows.
- **Where:** `packages/db` (Prisma 7). Read/written by **api** and **worker**; migrations run against it on deploy.
- **Env:** `DATABASE_URL` (api + worker + migrations). Use the **pooled** connection string with `?sslmode=require`.

### Railway
- **Why:** runs the two long-lived Node services + managed Redis in one project. Handles the monorepo Docker builds and native deps (ffmpeg/sharp) that Vercel can't.
- **Where:** hosts **api**, **worker**, **Redis**.
- **Env:** injects `PORT` into the api automatically; you set everything else per service (§4).

### Vercel
- **Why:** zero-config Next.js 16 host with per-PR preview URLs and edge routing for the `/api/*` proxy.
- **Where:** hosts **web** at `tacto.fyi`.
- **Env:** `API_URL`, `NEXT_PUBLIC_SITE_URL` (+ optional demo-guide vars).

### Redis (Railway plugin, or Upstash)
- **Why:** BullMQ queue backing store — the async spine between api (producer) and worker (consumer).
- **Where:** `apps/api/src/lib/queue.ts` (produce), `apps/worker/src/index.ts` (consume).
- **Env:** `REDIS_URL` (api + worker). On Railway reference it as `${{Redis.REDIS_URL}}`. **Note:** BullMQ needs a real Redis (blocking commands); if you use Upstash, use its Redis (not the REST) endpoint.

### Cloudflare R2
- **Why:** stores capture screenshots, PDF/MP4 exports, and voiceover audio (S3-compatible, no egress fees).
- **Where:** `packages/storage` (used by api for image/media/uploads, by worker for video/audio).
- **Env:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (api + worker). The storage client throws on first use if any is missing.

### OpenAI (default) / Anthropic (optional)
- **Why:** LLM for guide-step synthesis, FAQ generation, and whole-guide translation. Provider-agnostic — switching is an env change, never code.
- **Where:** `packages/ai` (`synthesize-guide`, `generate-faqs`, `translate-guide`), invoked by the **worker only**.
- **Env (worker):** `AI_PROVIDER` (`openai`\|`anthropic`, default `openai`), `AI_MODEL` (optional; defaults `gpt-5-mini` / `claude-haiku-4-5`), and the matching key: `OPENAI_API_KEY` **or** `ANTHROPIC_API_KEY`. The worker **fails fast at boot** if the selected provider's key is absent.

### ElevenLabs
- **Why:** text-to-speech for walkthrough voiceover.
- **Where:** `packages/ai/src/providers/elevenlabs.ts`; registered in the **worker** (audio synthesis). The **api** uses it only for synchronous editor voice previews.
- **Env:** `ELEVENLABS_API_KEY` (worker required for voiceover; api optional). Without it, voiceover jobs fail and the worker logs a warning at boot.

### Not wired (known gaps)
| Service | Status | Impact |
|---|---|---|
| **Email (Resend/SMTP)** | Not wired. `requireEmailVerification: false`; `sendInvitationEmail` only logs. | Invites are **link-based** (`/invite/{id}`); no password-reset/verification emails. |
| **Error tracking (Sentry)** | Not wired. | Errors surface only in Railway/Vercel logs (§11). Recommended first addition. |
| **Product analytics (PostHog)** | Not used. | Usage analytics are **first-party** (§11). |

---

## 4. Environment variables

Every var has a code default so **local dev needs no `.env`**. In **production,
set them explicitly** — never ship on the fallbacks (the `API_URL` fallback
points at `localhost` and would break every API call on Vercel).
Templates live in each app's `.env.example` (committed); real `.env*` are gitignored.

### Web (Vercel)

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `API_URL` | Origin the `/api/*` rewrite proxies to + all SSR fetches. **Baked at build time** on Vercel. | ✅ prod | `https://api.tacto.fyi` |
| `NEXT_PUBLIC_SITE_URL` | `metadataBase`, canonicals, OG, `robots.txt`, `sitemap.xml`. | ✅ prod | `https://tacto.fyi` |
| `NEXT_PUBLIC_DEMO_GUIDE` | shareId of the hero embed guide. | ⬜ optional | `uMj-0VML35Pa` |
| `NEXT_PUBLIC_DEMO_GUIDE_TOGGLE` | shareId of the scroll/walkthrough demo. | ⬜ optional | `uv9If_7NHl8y` |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | PostHog project token. Analytics no-ops when unset. | ⬜ optional | `phc_…` |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog app host (US). Ingestion is proxied via `/ingest`. | ⬜ optional | `https://us.posthog.com` |

### API (Railway) — validated by `apps/api/src/env.ts`

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `NODE_ENV` | Runtime mode. | set `production` | `production` |
| `PORT` | Listen port. **Railway injects this** — don't set it. | auto | `4100` |
| `DATABASE_URL` | Neon pooled connection. | ✅ | `postgresql://…@…neon.tech/tacto?sslmode=require` |
| `BETTER_AUTH_SECRET` | Session/token signing key, **≥32 chars**. `openssl rand -base64 32`. | ✅ | `a1B2…(44 chars)` |
| `BETTER_AUTH_URL` | Public origin auth is reached at = the **web** origin (proxy). | ✅ | `https://tacto.fyi` |
| `WEB_ORIGIN` | Trusted origin for CORS + auth. | ✅ prod | `https://tacto.fyi` |
| `REDIS_URL` | BullMQ connection. | ✅ prod | `${{Redis.REDIS_URL}}` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account. | ⚠️ uploads/media/video | `abc123…` |
| `R2_ACCESS_KEY_ID` | R2 access key. | ⚠️ | `…` |
| `R2_SECRET_ACCESS_KEY` | R2 secret. | ⚠️ | `…` |
| `R2_BUCKET` | R2 bucket name. | ⚠️ | `tacto-prod` |
| `ELEVENLABS_API_KEY` | Editor voice previews. | ⬜ optional | `sk_…` |
| `GOOGLE_CLIENT_ID` | Google OAuth (both or neither). | ⬜ optional | `…apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth. | ⬜ optional | `GOCSPX-…` |

> ⚠️ = optional to boot, but the feature 503s/fails without it. R2 is required
> for any capture that uploads media (i.e. all real usage).

### Worker (Railway) — validated by `apps/worker/src/env.ts`

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `NODE_ENV` | Runtime mode. | set `production` | `production` |
| `DATABASE_URL` | Same Neon DB. | ✅ | `postgresql://…?sslmode=require` |
| `REDIS_URL` | Same Redis as the API. | ✅ | `${{Redis.REDIS_URL}}` |
| `AI_PROVIDER` | `openai` or `anthropic`. | ⬜ (default `openai`) | `openai` |
| `OPENAI_API_KEY` | Required when `AI_PROVIDER=openai`. | ✅* | `sk-…` |
| `ANTHROPIC_API_KEY` | Required when `AI_PROVIDER=anthropic`. | ✅* | `sk-ant-…` |
| `AI_MODEL` | Override model id. | ⬜ optional | `gpt-5-mini` |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | R2 for video ingest + audio. | ⚠️ | `tacto-prod` |
| `ELEVENLABS_API_KEY` | Voiceover audio synthesis. | ⚠️ voiceover | `sk_…` |
| `REAPER_INTERVAL_SEC` | Stuck-capture sweep interval. | ⬜ (default `60`) | `60` |
| `STUCK_UPLOAD_TIMEOUT_MIN` | `UPLOADING` longer than this → FAILED. | ⬜ (default `10`) | `10` |
| `STUCK_PROCESSING_TIMEOUT_MIN` | `PROCESSING` longer than this → FAILED. | ⬜ (default `20`) | `20` |

> `*` The worker **exits at boot** if `AI_PROVIDER`'s key is missing.

### Extension (build-time, `WXT_` prefix)

| Variable | Purpose | Example |
|---|---|---|
| `WXT_API_BASE` | API origin the extension calls. | `https://api.tacto.fyi` |
| `WXT_APP_URL` | Web app origin (deep links). | `https://tacto.fyi` |

### Migrations
Use the **api service's** `DATABASE_URL` (migrations run as the api pre-deploy step).

---

## 5. First production deployment

From zero to a verified live stack. Do the steps in order — later steps depend on values from earlier ones.

### Prerequisites
Accounts: GitHub, Vercel, Railway, Neon, Cloudflare (R2 + DNS for `tacto.fyi`),
OpenAI (or Anthropic), ElevenLabs. The repo pushed to GitHub with `main` as
default branch.

```bash
openssl rand -base64 32        # → BETTER_AUTH_SECRET (save it)
```

### Step 1 — Create the Neon database
1. Neon console → **New Project** → region near your users.
2. Copy the **pooled** connection string (`?sslmode=require`). This is `DATABASE_URL`.

### Step 2 — Create the R2 bucket
1. Cloudflare dashboard → **R2** → create bucket `tacto-prod`.
2. **Manage R2 API Tokens** → create a token with **Object Read & Write** on that bucket.
3. Record `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

### Step 3 — Run migrations (once, before the API serves traffic)
The api pre-deploy runs `prisma migrate deploy` automatically, but seed the DB first from your machine to fail fast:

```bash
# packages/db/prisma.config.ts reads DATABASE_URL from env
DATABASE_URL="postgresql://…neon.tech/tacto?sslmode=require" \
  npm run db:deploy -w @workspace/db     # = prisma migrate deploy
```
This applies all 28 migrations (`init_auth` → `add_showcase`).

### Step 4 — Create the Railway project + Redis
1. Railway → **New Project → Deploy from GitHub repo** → select this repo.
2. **New → Database → Redis**. It exposes a private `REDIS_URL` as `${{Redis.REDIS_URL}}`.

### Step 5 — Deploy the API
1. In the project, the repo is one service. Configure it as **api**:
   - Settings → **Config-as-code path** = `apps/api/railway.json` (Dockerfile build + `start:prod` + `prisma migrate deploy` pre-deploy).
   - Leave **Root Directory** empty (build context = repo root; the Dockerfile copies the monorepo).
   - **Variables:** the whole [API table](#api-railway--validated-by-appsapisrcenvts). Set `REDIS_URL=${{Redis.REDIS_URL}}`. Leave `BETTER_AUTH_URL`/`WEB_ORIGIN` = `https://tacto.fyi` (you'll point DNS there in step 8).
   - **Networking → Generate Domain**, then add custom domain `api.tacto.fyi`.
2. Watch the deploy log: it should show migrations applied, then `tacto api listening…`.

### Step 6 — Deploy the Worker
1. **New → GitHub Repo** (same repo) → second service, name it **worker**.
2. Config-as-code path = `apps/worker/railway.json`. **No** public domain.
3. **Variables:** the [Worker table](#worker-railway--validated-by-appsworkersrcenvts) — `DATABASE_URL`, `REDIS_URL=${{Redis.REDIS_URL}}`, `AI_PROVIDER` + its key, `R2_*`, `ELEVENLABS_API_KEY`.
4. Log should show four `tacto worker ready — queue "…"` lines.

### Step 7 — Configure Vercel (web)
1. Vercel → **Add New → Project** → import the repo.
2. **Root Directory** = `apps/web` (framework auto-detects as Next.js).
3. **Environment Variables** (Production + Preview): `API_URL=https://api.tacto.fyi`, `NEXT_PUBLIC_SITE_URL=https://tacto.fyi` (+ optional demo vars).
4. Deploy.

### Step 8 — DNS + custom domains (Cloudflare)
| Record | Name | Target |
|---|---|---|
| A / CNAME | `tacto.fyi` (+ `www` → redirect) | Vercel (per Vercel's domain screen) |
| CNAME | `api` | Railway's domain target (**DNS-only / grey cloud**) |

Add `tacto.fyi` in Vercel's **Domains**, `api.tacto.fyi` in Railway's networking. SSL is issued automatically by both.

### Step 9 — Verify health endpoints
```bash
curl https://api.tacto.fyi/api/health      # {"status":"ok"}  (direct)
curl https://tacto.fyi/api/health          # {"status":"ok"}  (via the web proxy)
```
Both must return `200 {"status":"ok"}`. If the second fails, `API_URL` on Vercel is wrong.

### Step 10 — Smoke test (end to end)
1. Open `https://tacto.fyi` → sign up (email/password). You land in a dashboard with a personal workspace.
2. Build the extension pointed at prod and load it unpacked to confirm capture:
   ```bash
   WXT_API_BASE=https://api.tacto.fyi WXT_APP_URL=https://tacto.fyi \
     npm run build -w apps/extension
   ```
   Record a short workflow → a capture appears and, within seconds, becomes a guide (proves **api → Redis → worker → OpenAI → DB**).
3. Publish the guide → open its `/g/{shareId}` public page in an incognito window (proves public read + R2 screenshots).
4. (Optional) Generate voiceover on a step → confirms ElevenLabs + R2 audio.

### Step 11 — Lock in CI
GitHub → **Settings → Branches** → protect `main`: *Require status checks* → **CI**, and *Require a pull request before merging*.

---

## 6. Updating production

```
feature branch ──► PR ──► CI (typecheck·lint·build·web tests) ──► review ──► merge to main
                                                                                │
                             ┌──────────────────────────────────────────────────┤
                             ▼                                                    ▼
                      Vercel builds & promotes web              Railway rebuilds api + worker
                      (preview URL was already on the PR)       api pre-deploy: prisma migrate deploy
```

**Exactly what happens on merge to `main`:**
1. GitHub Actions CI must be green (the branch protection gate).
2. **Vercel** detects the push, runs `next build` with the project's env, and promotes the new deployment to `tacto.fyi`. Every PR already had its own preview URL.
3. **Railway** rebuilds **api** and **worker** from their Dockerfiles. The **api** runs `prisma migrate deploy` as its pre-deploy step (before the new version takes traffic); only the api runs migrations, so there's no race.
4. Old Railway versions keep serving until the new one is healthy, then traffic cuts over.

Nothing is manual. The **extension** is released separately (§ below).

**Extension release (manual):** rebuild with prod `WXT_*` env, zip `apps/extension/.output`, upload to the Chrome Web Store dashboard, submit for review.

---

## 7. Rollback strategy

Rollback is **not just Git** — code and schema roll back differently.

| Layer | How to roll back | Notes |
|---|---|---|
| **Web (Vercel)** | Deployments → pick last-good → **Promote to Production**. | Instant; no rebuild. |
| **API (Railway)** | api service → Deployments → **Redeploy** a previous build. | Redeploying an *older image* does **not** revert migrations (see below). |
| **Worker (Railway)** | worker service → **Redeploy** a previous build. | Safe to roll back independently; jobs are idempotent-ish (retried). |
| **Database (Neon)** | Migrations are **forward-only** — never redeploy an old image expecting the schema to revert. | Use a Neon **branch/restore** to a point in time, or ship a *new* migration that reverts the change. |

**Migration safety rules (critical):**
- Migrations are **additive-first**. A new NOT NULL column must ship with a default or a backfill, or it breaks existing rows.
- **Never edit an applied migration.** To undo, write a new migration.
- **Order for risky changes:** deploy code that tolerates *both* shapes → deploy the migration → later remove the old-shape code. This lets you roll back the app image without a schema mismatch.
- Take a **Neon branch snapshot before any destructive migration** (drops, type changes, backfills).

---

## 8. Database

- **Client:** Prisma 7 (`packages/db`). Generated client → `packages/db/src/generated` (built during the Docker image + on Vercel via Turbo's dependency graph).
- **Config:** `packages/db/prisma.config.ts` — Prisma 7 doesn't auto-load env, so it `import "dotenv/config"` and reads `DATABASE_URL` via `env()`. Schema at `prisma/schema.prisma`, migrations at `prisma/migrations` (28 applied).
- **Host:** Neon serverless Postgres. Use the **pooled** URL in app services.

### Migration workflow

| Context | Command |
|---|---|
| Local: create + apply a migration | `npm run db:migrate -w @workspace/db` (`prisma migrate dev`) |
| Regenerate the client only | `npm run db:generate -w @workspace/db` |
| **Production apply** | `npm run db:deploy -w @workspace/db` (`prisma migrate deploy`) — runs automatically as the api pre-deploy |
| Inspect data | `npm run db:studio -w @workspace/db` |

### Production migration policy
- All schema changes go through committed migration files (never `db push` in prod).
- `prisma migrate deploy` applies only *pending, already-authored* migrations — it never generates or resets.
- CI builds run `prisma generate` (no DB connection needed); the actual apply happens only at api deploy time.

### Backup & restore (Neon)
- **Backups:** Neon keeps continuous history (point-in-time restore) for the plan's retention window. Before risky changes, create a **named branch** off `main` as an explicit snapshot.
- **Restore:** Neon console → **Restore** to a timestamp, *or* create a branch at a past point, verify it, then repoint `DATABASE_URL` to it. Update the api + worker + migrations `DATABASE_URL` and redeploy.

---

## 9. Worker & queues

The worker (`apps/worker/src/index.ts`) runs **four** BullMQ workers against the
shared Redis. The API only **produces** (`apps/api/src/lib/queue.ts`).

| Queue | Job | Concurrency | Attempts | Backoff | On final failure |
|---|---|---|---|---|---|
| `capture` | `processCapture` (capture → guide via AI) | 3 | 3 | exp, 3 s | Capture row → `FAILED` + `errorMessage` |
| `voice` | narration generate / audio synthesize | 4 | 3 | exp, 3 s | Narration status → `failed` |
| `translation` | whole-guide translation | 3 | 3 | exp, 3 s | Translation status → `failed` |
| `export` | ffmpeg video composition (CPU-heavy) | **1** | **1** | — | MediaRender → failed |

Shared job options: `removeOnComplete/Fail: { count: 500 }`, `maxRetriesPerRequest: null`.

### Retries & dead jobs
- Failed jobs retry with exponential backoff up to `attempts`. Only when retries are **exhausted** does the domain row get marked `FAILED`.
- `export` gets a single attempt (ffmpeg is expensive; a failed export is retried by the user, not the queue).
- Completed/failed jobs are retained (last 500 each) for inspection, then trimmed.

### Recovery & self-healing
- **Stalled jobs:** if a worker crashes mid-job, BullMQ re-queues the job after `stalledInterval` (30 s; 60 s for export). After `maxStalledCount` stalls (2; 1 for export) it's moved to failed.
- **Reaper** (`reaper.ts`): sweeps captures orphaned *outside* the queue — `UPLOADING` > `STUCK_UPLOAD_TIMEOUT_MIN` (10 m) or `PROCESSING` > `STUCK_PROCESSING_TIMEOUT_MIN` (20 m) → `FAILED`. Interval `REAPER_INTERVAL_SEC` (60 s).
- **Voice GC:** every 30 min, deletes orphaned audio renders (superseded by edits), with a grace window for in-flight builds.
- **Graceful shutdown:** `SIGINT`/`SIGTERM` → finish in-flight jobs, close all four workers, exit. Railway sends `SIGTERM` on deploy, so in-flight jobs aren't dropped.

**Scaling the worker:** run more worker instances (Railway replicas). Queues distribute across them automatically. Keep `export` concurrency at 1 per instance (ffmpeg is CPU-bound).

---

## 10. Storage

Cloudflare **R2** (S3-compatible), via `packages/storage`.

| Content | Producer | Path/kind |
|---|---|---|
| Capture screenshots | worker (capture pipeline) | per-step PNGs |
| Voiceover audio | worker (voice synthesis) | per-segment audio |
| Video exports | worker (ffmpeg) | MP4 |
| PDF exports | web (`lib/pdf.ts`, client-side) | downloaded, not stored |
| Presigned upload targets | api (`uploads`/`media` routers) | browser/extension → R2 direct |

- **Public assets** (favicon, `embed.js`, marketing images) are served by **web** from `apps/web/public` and `app/` — not R2.
- **Generated media** URLs handed to the browser are **presigned** and time-limited. Public pages are rendered fresh per request (`no-store`) so the presigned URLs are always valid at view time.
- **Backups:** enable **R2 versioning/lifecycle** on the bucket for accidental-delete protection. Screenshots/audio are reproducible from a re-capture/re-synthesis, so R2 is recoverable-by-regeneration for most objects; exports are user-triggered and re-creatable.

---

## 11. Monitoring

This repo ships **first-party** analytics and relies on provider logs. There is
no third-party APM/error tracker yet.

| Concern | What exists | Where |
|---|---|---|
| **Product analytics** | First-party event log — `GuideEvent`, help-center events, showcase events — written via `sendBeacon`, aggregated by pure functions, surfaced at `/guides/[id]/analytics`, `/showcases/[id]`, help-center dashboards. **No PostHog.** | api `features/*/analytics.ts`, DB tables |
| **API/Worker logs** | Structured `console` logs (job ids, timings, failures). | **Railway** → each service → Logs (searchable, tail-able) |
| **Web logs** | SSR + function logs. | **Vercel** → project → Logs / Observability |
| **Health** | `GET /api/health` → `{"status":"ok"}` (no auth, no DB — pure liveness). | api; also reachable via `tacto.fyi/api/health` |
| **Metrics** | Railway per-service CPU/RAM/network; Vercel build + function metrics; Neon dashboard (connections, storage); Redis (Railway) memory. | provider dashboards |
| **Error tracking** | **None wired.** Errors appear only in logs. | — |

**Recommended next addition:** Sentry in api + worker (`errorHandler` middleware
is the natural hook) and web, for aggregated error alerting. Set a Railway
**health check path** of `/api/health` on the api service so failed boots don't
take traffic.

---

## 12. Security

| Area | Implementation |
|---|---|
| **Secrets** | All secrets are host-managed env vars (Railway/Vercel). Real `.env*` are gitignored; only `.env.example` templates are committed. Never commit keys. |
| **Sessions ("JWT")** | better-auth sessions signed with `BETTER_AUTH_SECRET` (≥32 chars). Web + API are **same public origin** (`/api/*` proxied), so session **cookies are first-party** — Safari ITP-safe. |
| **Extension auth** | The `bearer()` plugin lets the extension send `Authorization: Bearer <sessionToken>` (cookies can't cross to `chrome-extension://`). |
| **CORS** | api allows only: no-origin (server-to-server), `chrome-extension://*`, and `WEB_ORIGIN`. `credentials: true`, headers limited to `Content-Type`/`Authorization`. |
| **Auth handler ordering** | `better-auth` mounts on the **raw body** before `express.json()` (required); our routes parse JSON after. |
| **HTTPS** | Terminated by Vercel, Railway, and Cloudflare. All public origins are HTTPS-only. |
| **Framing / clickjacking** | `next.config.ts` sets `CSP: frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN` everywhere **except** `/embed/*`, which is intentionally `frame-ancestors *` (embeds must iframe anywhere) and `X-Robots-Tag: noindex`. |
| **Rate limiting** | In-memory fixed-window limiter (`lib/rate-limit.ts`) on abuse-prone public endpoints. **Per-instance** — see the scaling caveat below. |
| **Upload limits** | Uploads go **direct to R2 via presigned URLs** (they don't stream through the API body). JSON bodies use Express's default parser limit. |
| **Auth policy** | Email verification is **off** (`requireEmailVerification: false`); Google OAuth enabled only when both `GOOGLE_*` are set; account deletion cascades to solely-owned workspaces. |

> **Scaling caveat:** the rate limiter and better-auth's defaults are fine for a
> single api instance. If you run **multiple** api replicas, move rate limiting
> to a Redis-backed limiter (Redis is already provisioned) so limits are shared.

---

## 13. CI/CD

**File:** `.github/workflows/ci.yml`. **Triggers:** every PR and every push to `main`.

```
push / PR ─► actions/checkout ─► setup-node@22 (npm cache) ─► npm ci
          ─► npx turbo run typecheck lint build
          ─► npm run test --workspace web
```

| Check | What it does | Blocking |
|---|---|---|
| **typecheck** | `tsc --noEmit` across every app + package (Turbo orders `prisma generate` first). | ✅ |
| **lint** | ESLint across the monorepo. | ✅ |
| **build** | `next build` (web) + `tsc --noEmit` (api/worker). Proves prod build compiles. | ✅ |
| **test** | web unit tests (embed SDK, permissions, editor history, draft cache). | ✅ |

- CI needs **no secrets** (build uses placeholder `API_URL`/`DATABASE_URL`; `prisma generate` doesn't connect).
- **Production branch = `main`.** Vercel + Railway watch `main` and auto-deploy on green merge. CI is the *gate*; the hosts are the *deployers*.
- Integration tests that need a live DB/Redis (api/worker `test` scripts) are **not** in CI — run them locally or add Postgres/Redis service containers if you want them gated.

---

## 14. Disaster recovery

### Scenario A — Railway disappears (api/worker/Redis gone)
1. **Data is safe** — Postgres is on Neon, media on R2. Only compute + queue are lost.
2. Recreate the Railway project → add Redis → recreate **api** and **worker** from the same repo + config-as-code paths (`apps/*/railway.json`), re-enter env vars.
3. Point `api.tacto.fyi` at the new Railway domain.
4. In-flight jobs at the time of loss are gone (Redis was ephemeral); the **reaper** marks any orphaned captures `FAILED` so users can retry. No data corruption.
5. **Alternative host:** the Dockerfiles are provider-agnostic — the same images run on Render/Fly with the same env + a managed Redis.

### Scenario B — Neon is accidentally deleted
1. If within Neon's retention: **restore** the project/branch to the last good point (Neon console → Restore). Repoint `DATABASE_URL` (api + worker + migrations), redeploy.
2. If the project is truly gone: create a new Neon project, set `DATABASE_URL`, run `npm run db:deploy -w @workspace/db` to recreate the schema from migrations, then restore data from your latest Neon backup/branch export.
3. **Preventive:** keep a periodic `pg_dump` (Neon supports it) in R2 or elsewhere, and snapshot a Neon branch before destructive migrations.

### Scenario C — R2 bucket lost
- Screenshots/audio are **regenerable** (re-capture / re-synthesize). Exports are user-triggered. Recreate the bucket + token, set `R2_*`, and content repopulates as guides are re-processed. Enable versioning to avoid this entirely.

---

## 15. Production checklist

```
Infrastructure
  □ Neon database created; pooled DATABASE_URL saved
  □ Migrations applied (prisma migrate deploy succeeded)
  □ R2 bucket + API token created; R2_* saved
  □ Railway project created; Redis added; REDIS_URL wired
  □ API service deployed (Dockerfile + railway.json)
  □ Worker service deployed
  □ Web deployed on Vercel (Root Directory = apps/web)
  □ All env vars set per §4 (no reliance on fallbacks)
  □ DNS: tacto.fyi → Vercel, api.tacto.fyi → Railway
  □ SSL verified on both domains
  □ CI required on main (branch protection)

Verification
  □ GET api.tacto.fyi/api/health → 200 {"status":"ok"}
  □ GET tacto.fyi/api/health → 200 (proxy works)
  □ Sign up / log in works (cookies first-party)
  □ Queue processing works (capture → guide appears)
  □ Uploads work (screenshots land in R2)
  □ AI generation works (steps synthesized)
  □ Voice generation works (ElevenLabs audio)
  □ Translation works
  □ Video export works (ffmpeg MP4)
  □ Extension connects (Bearer) and captures
  □ Guides publish (/g/{shareId} + HowTo JSON-LD)
  □ Forms publish (/f/{shareId})
  □ Help Center works (/help/{slug}/…)
  □ Showcases work (/showcase/{slug})
  □ Analytics events record (guide analytics page)

Known N/A (not wired — see §3/§11)
  ▨ Emails — link-based invites only (no Resend/SMTP)
  ▨ Error tracking — logs only (no Sentry)
```

---

## 16. Future scaling

Current setup (single api + worker, one Redis, one Neon) comfortably handles
early usage. Evolve **only when a metric forces it** — don't pre-build.

| Stage | Likely pressure | Change |
|---|---|---|
| **~10k users** | Worker backlog during capture spikes. | Add **worker replicas** on Railway (queues auto-distribute). Move **rate limiting to Redis-backed** so multiple api instances share limits. Turn on **R2 versioning**. |
| **~100k users** | API CPU/latency; read-heavy public pages; DB connections. | **Horizontally scale the API** (multiple replicas behind Railway's LB) — requires the Redis rate limiter first. Add a **dedicated Redis** (separate from BullMQ, or a managed Redis Cloud) if queue + cache contend. Enable **Neon autoscaling** / a **read replica** for public read APIs + sitemap. Cache public guide/help responses (CDN or `s-maxage`) instead of `no-store` where freshness allows. |
| **~1M users** | Sustained ingest; export/ffmpeg cost; global latency. | **Autoscale workers** by queue depth; split heavy `export`/`video` onto a dedicated worker pool (CPU-optimized). Introduce **Neon read replicas + connection pooling** (PgBouncer/Neon proxy). Front R2 with the **Cloudflare CDN** for media. Add **Sentry + real APM** and per-queue dashboards. Consider regional web deployments (Vercel handles this) and edge-cache the marketing/pSEO pages. |

**Guardrails that already scale-block if ignored:** the in-memory rate limiter
and better-auth defaults assume a single api instance — fix those *before* adding
the second api replica, or you'll get inconsistent limits and session behavior.
