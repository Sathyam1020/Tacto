<div align="center">

# Tacto

**Guides that write themselves.**

Record any workflow once — Tacto turns every click into a polished step-by-step
guide, interactive walkthrough, or branded help center. No writing, no editing.

`Next.js 16` · `Express 5` · `BullMQ` · `Prisma 7 / Neon` · `Cloudflare R2` · `Turborepo`

</div>

---

## What is Tacto?

Tacto is an AI knowledge-capture platform. A Chrome extension records a browser
workflow; the pipeline captures every click + screenshot, and AI writes a clean,
one-step-per-action guide. From a single recording you get:

- 📄 **Step-by-step guides** — AI-written instructions with the click marked on every screenshot
- 🖱️ **Interactive walkthroughs** — spotlighted, click-through demos with a Guidejar-style player (voiceover, captions, timeline)
- 🏢 **Help centers** — a searchable, branded knowledge base on your own domain
- 🖼️ **Showcases** — curated, embeddable collections
- 📝 **Forms** — collect answers inside a guide
- 📊 **Analytics** — views, completion, and drop-off per guide
- 🌍 **Translations & voiceover**, **PDF/MP4 export**, and **PII redaction**
- 🔗 **Embeds everywhere** + a full marketing/pSEO site with `HowTo`/`FAQ` structured data

---

## Tech stack

| Layer | Choice |
|---|---|
| Monorepo | Turborepo + npm workspaces |
| Frontend | Next.js 16 (App Router, RSC), React 19, Tailwind, `motion/react`, base-ui + shadcn (`@workspace/ui`) |
| API | Express 5, run directly via `tsx` |
| Auth | better-auth (email/password + Google; orgs = workspaces; Bearer for the extension) |
| Jobs | BullMQ + Redis (capture · voice · translation · export queues) |
| Worker | Node + `ffmpeg-static` + `sharp` |
| Database | Prisma 7 → Neon Postgres |
| Storage | Cloudflare R2 (S3-compatible) |
| AI | OpenAI / Anthropic (provider-agnostic) + ElevenLabs (TTS) |
| Extension | WXT (Vite) Chrome extension |
| Validation | zod contracts shared across apps (`@workspace/contracts`) |

---

## Monorepo structure

```
tacto/
├── apps/
│   ├── web/         Next.js frontend  → Vercel   (:3100)
│   ├── api/         Express API       → Railway  (:4100)
│   ├── worker/      BullMQ consumer   → Railway
│   └── extension/   WXT Chrome ext    → Web Store
├── packages/
│   ├── contracts/   zod schemas (source of truth, shared by api + web)
│   ├── db/          Prisma 7 client + migrations (Neon)
│   ├── ai/          LLM + TTS: synthesize-guide, faqs, narration, translate
│   ├── generation/  orchestration: audio, narration, translation, video-export
│   ├── storage/     Cloudflare R2 client
│   ├── ui/          shared design system (@workspace/ui)
│   ├── eslint-config/ · typescript-config/
└── docs/            RFCs + implementation plans (phase-01 … phase-18)
```

> Full tree and per-file breakdown: see the repo. Architecture deep-dive:
> [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## Quick start

**Prerequisites:** Node `>= 20` (Docker images use 22), npm `11`, and a Redis
for the job queue (`docker run -p 6379:6379 redis`). You'll need a Postgres
(Neon) connection string and, for AI features, an OpenAI/ElevenLabs key.

```bash
# 1. install
npm install

# 2. configure env (each app has a template; every var has a dev fallback,
#    so the web app runs with none — the API/worker need at least a DB + Redis)
cp apps/api/.env.example    apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp packages/db/.env.example packages/db/.env      # DATABASE_URL

# 3. database
npm run db:migrate -w @workspace/db               # apply migrations

# 4. run everything (web :3100 · api :4100 · worker)
npm run dev
```

Open **http://localhost:3100**. Sign up → you get a personal workspace. To
capture, build the extension (`npm run build -w apps/extension`) and load
`apps/extension/.output` unpacked in Chrome.

---

## Environment variables

Every variable has a code fallback, so **local dev needs minimal config**. For a
real setup, each app documents its own vars in a committed `.env.example`:

| App | Template | Needs at minimum (local) |
|---|---|---|
| `web` | `apps/web/.env.example` | nothing (fallbacks) — set `API_URL` if your API isn't on `:4100` |
| `api` | `apps/api/.env.example` | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `REDIS_URL` |
| `worker` | `apps/worker/.env.example` | `DATABASE_URL`, `REDIS_URL`, an AI key (`OPENAI_API_KEY`) |
| `db` | `packages/db/.env.example` | `DATABASE_URL` |

Real `.env*` files are gitignored; only the `.env.example` templates are
committed. **Full production env reference:** [`DEPLOYMENT.md` §4](./DEPLOYMENT.md#4-environment-variables).

---

## Commands

Run from the repo root (Turborepo orchestrates across apps/packages):

| Command | What it does |
|---|---|
| `npm run dev` | Start web + api + worker in watch mode |
| `npm run build` | Build everything (`next build` + `tsc --noEmit` + `prisma generate`) |
| `npm run lint` | ESLint across the monorepo |
| `npm run typecheck` | `tsc --noEmit` across every app + package |
| `npm run format` | Prettier write |

Database (workspace `@workspace/db`):

| Command | What it does |
|---|---|
| `npm run db:migrate -w @workspace/db` | Create + apply a migration (dev) |
| `npm run db:deploy -w @workspace/db` | Apply pending migrations (production) |
| `npm run db:generate -w @workspace/db` | Regenerate the Prisma client |
| `npm run db:studio -w @workspace/db` | Open Prisma Studio |

Target a single package with `--filter`, e.g. `npx turbo run build --filter=web`.

---

## Testing

Tests run with `tsx` (no test framework runtime). Per app:

```bash
npm run test -w web          # pure unit tests (embed SDK, permissions, editor history…)
npm run test -w apps/api     # api logic + integration (needs a DB/env)
npm run test -w apps/worker  # pipeline unit tests
```

CI runs `typecheck · lint · build · web tests` on every PR — see
[CI/CD](./DEPLOYMENT.md#13-cicd).

---

## Deployment

Production runs on **Vercel** (web) + **Railway** (api, worker, Redis) with
**Neon** (Postgres) and **Cloudflare R2** (storage). Deploys are provider-native
on merge to `main`; GitHub Actions is the CI gate.

👉 **Complete, from-zero guide:** [`DEPLOYMENT.md`](./DEPLOYMENT.md) — architecture,
per-service env tables, first deploy walkthrough, rollback, migration policy,
disaster recovery, and a production checklist.

---

## Documentation

| Doc | What's in it |
|---|---|
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Production deployment, ops, scaling, DR |
| [`DESIGN.md`](./DESIGN.md) | Design system (Datum) — tokens, type, motion |
| [`AGENTS.md`](./AGENTS.md) | Conventions & guardrails for working in this repo |
| [`docs/plans/`](./docs/plans) | Phase RFCs + implementation plans (auth → showcases → marketing) |
| [`docs/embed.md`](./docs/embed.md) | Embed SDK reference |

---

<div align="center">
<sub>Built with Turborepo. © 2026 Tacto.</sub>
</div>
