# Deploying Tacto

Production topology and the one-time setup to get there. After setup, **every
merge to `main` deploys automatically**.

```
                        ┌────────────────────────────────────────┐
   Browser ── tacto.fyi ─▶  Vercel: web (Next.js 16)              │
                        │     /api/*  ──rewrite──▶ api.tacto.fyi   │
                        └───────────────────────────┬─────────────┘
                                                    │
   Chrome extension ──(Bearer, CORS)──▶ api.tacto.fyi  (Railway: api, Express)
                                                    │  enqueues jobs
                                                    ▼
                                            Railway: Redis  ◀── consumes ── Railway: worker
                                                    │                         (ffmpeg + sharp)
                          ┌─────────────────────────┼─────────────────────────┐
                          ▼                          ▼                         ▼
                     Neon (Postgres)         Cloudflare R2            OpenAI / ElevenLabs
```

| Service | Host | Deploys when |
|---|---|---|
| `web` | **Vercel** (root dir `apps/web`) | push to `main` (+ preview per PR) |
| `api` | **Railway** (Dockerfile) | push to `main` |
| `worker` | **Railway** (Dockerfile) | push to `main` |
| `Redis` | **Railway** plugin | managed |
| Postgres | **Neon** | managed |
| Object storage | **Cloudflare R2** | managed |

---

## 0. Prerequisites

Accounts: **GitHub** (repo pushed), **Vercel**, **Railway**, **Neon**, **Cloudflare** (R2 + DNS for `tacto.fyi`). Have ready: your Neon `DATABASE_URL`, R2 credentials + bucket, OpenAI key, ElevenLabs key, Google OAuth client (optional).

Generate the auth secret once:

```bash
openssl rand -base64 32   # → BETTER_AUTH_SECRET
```

---

## 1. Continuous integration (already in the repo)

`.github/workflows/ci.yml` runs on every PR and on `main`: `npm ci` → `turbo run typecheck lint build` → web unit tests. It needs **no secrets**.

In **GitHub → Settings → Branches**, add a rule for `main`: *Require status checks to pass* → select **CI**, and *Require a pull request before merging*. That makes green CI the gate; the hosts below deploy only after `main` moves.

---

## 2. Railway — api + worker + Redis (one project)

1. **New Project → Deploy from GitHub repo** → pick this repo.
2. **Add Redis**: *New → Database → Redis*. It exposes a private `REDIS_URL`.
3. **api service** — from the repo:
   - Settings → **Config-as-code path** = `apps/api/railway.json` (sets the Dockerfile build, the start command, and runs `prisma migrate deploy` as the pre-deploy step).
   - Leave the service **Root Directory** empty (build context = repo root; the Dockerfile copies the whole monorepo).
   - **Variables** — see the [api table](#api-railway). Reference Redis with `${{Redis.REDIS_URL}}`.
   - **Networking → Generate Domain**, then add the custom domain `api.tacto.fyi` (Railway shows the CNAME target — add it in Cloudflare DNS, DNS-only/grey cloud).
4. **worker service** — *New → GitHub Repo* (same repo, second service):
   - Config-as-code path = `apps/worker/railway.json`. No public domain (it's a background consumer).
   - **Variables** — see the [worker table](#worker-railway).

Migrations run automatically before each `api` deploy (`preDeployCommand` in `apps/api/railway.json`). Only the api service runs them, so there's no race.

<a name="api-railway"></a>**api variables**

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon pooled connection string (`?sslmode=require`) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `BETTER_AUTH_SECRET` | the `openssl rand` value |
| `BETTER_AUTH_URL` | `https://tacto.fyi` (the public origin auth is reached through) |
| `WEB_ORIGIN` | `https://tacto.fyi` (CORS allowlist) |
| `R2_ACCOUNT_ID` `R2_ACCESS_KEY_ID` `R2_SECRET_ACCESS_KEY` `R2_BUCKET` | Cloudflare R2 |
| `OPENAI_API_KEY` | OpenAI |
| `ELEVENLABS_API_KEY` | ElevenLabs (voice-over) |
| `AI_PROVIDER` / `AI_MODEL` | e.g. `openai` / `gpt-5-mini` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional (Google sign-in) |

> Railway injects `PORT` automatically — the API reads `process.env.PORT`. Don't set it.

<a name="worker-railway"></a>**worker variables**: `NODE_ENV`, `DATABASE_URL`, `REDIS_URL` (`${{Redis.REDIS_URL}}`), `R2_*`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `AI_PROVIDER`, `AI_MODEL`. (No auth/web-origin — it doesn't serve HTTP.)

---

## 3. Vercel — web

1. **Add New → Project** → import the repo.
2. **Root Directory** = `apps/web`. Framework auto-detects as **Next.js**; leave build/install as default (Vercel installs from the workspace root and runs `next build`).
3. **Environment Variables** (Production + Preview):

| Key | Value |
|---|---|
| `API_URL` | `https://api.tacto.fyi` — the `/api/*` rewrite target (baked at build, so it must be set) |
| `NEXT_PUBLIC_SITE_URL` | `https://tacto.fyi` — `metadataBase`, canonicals, sitemap |
| `NEXT_PUBLIC_DEMO_GUIDE` / `NEXT_PUBLIC_DEMO_GUIDE_TOGGLE` | optional — shareIds for the landing embeds |

4. **Domains** → add `tacto.fyi` (and `www` → redirect). Point Cloudflare DNS at Vercel per its instructions.

Auth stays first-party because the browser only ever talks to `tacto.fyi`; `/api/*` is proxied server-side to the API, so cookies are set on `tacto.fyi`.

---

## 4. DNS (Cloudflare)

| Record | Name | Target |
|---|---|---|
| A / CNAME | `tacto.fyi` (+ `www`) | Vercel (per Vercel's domain screen) |
| CNAME | `api` | Railway's domain target (DNS-only / grey cloud) |

---

## 5. Deploy flow (after setup)

```
branch → PR → CI (typecheck·lint·build·test) must pass → merge to main
   main → Vercel builds & promotes web
        → Railway builds api (runs `prisma migrate deploy`, then starts) and worker
```

Nothing manual. PRs get a Vercel **preview URL** automatically.

---

## 6. First deploy checklist

1. Push the repo to GitHub (`main`).
2. Set up Neon + R2; copy their values.
3. Create the Railway project, add Redis, create **api** and **worker** with the variables above and their config-as-code paths.
4. Add `api.tacto.fyi` on Railway + the Cloudflare CNAME.
5. Create the Vercel project (root `apps/web`) with `API_URL` + `NEXT_PUBLIC_SITE_URL`; add `tacto.fyi`.
6. Confirm the api deploy log shows migrations applied, then hit `https://api.tacto.fyi` and `https://tacto.fyi`.
7. Enable branch protection requiring **CI** on `main`.

---

## 7. Rollback

- **Vercel**: Deployments → pick the last good one → *Promote to Production*.
- **Railway**: service → Deployments → *Redeploy* a previous build.
- **DB**: migrations are forward-only. To undo a schema change, ship a new migration that reverts it (never edit an applied migration). Take a Neon branch/snapshot before risky migrations.

---

## 8. Chrome extension (separate release)

The extension (`apps/extension`, WXT) isn't part of the web/API pipeline — it ships to the Chrome Web Store manually. Build it pointed at production:

```bash
WXT_API_BASE=https://api.tacto.fyi WXT_APP_URL=https://tacto.fyi npm run build -w apps/extension
```

Then upload the zipped `.output` to the Web Store dashboard. Its origin (`chrome-extension://<id>`) is already allowed by the API's CORS.

---

## 9. Local development

```bash
cp apps/api/.env.example apps/api/.env        # fill in
cp apps/worker/.env.example apps/worker/.env  # fill in
cp packages/db/.env.example packages/db/.env  # DATABASE_URL

npm install
npm run db:migrate -w @workspace/db           # apply migrations locally
npm run dev                                    # web :3100 · api :4100 · worker
```

Redis locally: `docker run -p 6379:6379 redis` (or Railway's shared instance).

---

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Web builds but API calls 404/500 | `API_URL` unset/wrong on Vercel, or `api.tacto.fyi` DNS not resolving |
| Login fails / cookies not set | `BETTER_AUTH_URL` ≠ `https://tacto.fyi`, or `WEB_ORIGIN` mismatch |
| `worker` boots then crashes | missing `REDIS_URL`/`DATABASE_URL`, or sharp/ffmpeg binary — rebuild the image (they install via `npm ci`) |
| Migrations didn't run | check the api deploy log's pre-deploy step; ensure `DATABASE_URL` is set on the api service |
| Extension can't reach API | rebuilt with the wrong `WXT_API_BASE`, or `WEB_ORIGIN`/CORS |
