# Tacto — Phase 1: Authentication (shipped)

> Retrospective summary — this phase shipped before docs/plans existed.

## What shipped

- **`packages/db`** — Prisma 7 (new `prisma-client` generator, `prisma.config.ts`, `PrismaPg` driver adapter, Neon PostgreSQL). better-auth core models: `User`, `Session`, `Account`, `Verification`.
- **`packages/contracts`** — zod v4 schemas shared api↔web (`signUpSchema`, `signInSchema`, `userSchema`).
- **`apps/api`** — Express 5 (ESM, tsx). Feature-first structure (`src/features/*`), zod-validated env (fail fast), better-auth via `toNodeHandler` mounted **before** `express.json()` at `/api/auth/*splat`, `requireAuth` middleware (`fromNodeHeaders` → session → `req.user`), central `AppError`/zod error middleware. Email/password enabled; Google OAuth env-conditional.
- **`apps/web`** — Next.js rewrites proxy `/api/*` → API (:4000) so auth cookies stay first-party (Safari ITP). better-auth React client (use `authClient.*` directly — destructured re-exports break TS declaration portability, TS2742). React Query provider, axios instance, zustand UI store. Sign-in/sign-up pages + protected /library placeholder in the Tacto design system.

## Key decisions

| Decision | Why |
|---|---|
| Reverse proxy over CORS for web | Safari ITP blocks cross-origin auth cookies; first-party cookies just work |
| better-auth over hand-rolled | Sessions, OAuth, hashing maintained upstream; Prisma adapter |
| Hand-written auth models | CLI generation had a chicken-egg with env validation; models follow better-auth's documented core schema exactly |
| `BETTER_AUTH_URL` = web origin | Auth is reached through the proxy, so its public base is :3000 |

## Verification (done)

Typecheck/lint/build green; migration applied to Neon; browser flow verified: sign-up → /library → refresh (session persists) → sign-out → guard redirect → sign-in.
