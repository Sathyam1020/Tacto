# Phase 19 — PostHog Product Analytics (RFC)

**Status:** proposed · **Author:** eng · **Scope:** web + api + worker + a new
`@workspace/analytics` package · **Depends on:** better-auth identity, the
existing first-party guide analytics (phase-12), the `/api` proxy in
`apps/web/next.config.ts`.

---

## 1. Summary

Add **PostHog** as Tacto's product-analytics layer — to answer *"who signs up,
what activates them, which features retain them, and where the funnel leaks"* —
across the marketing site and the authenticated app, with server-authoritative
events from the API and the worker pipeline.

This is **product analytics for Tacto's own funnel**, and it deliberately does
**not** replace the phase-12 first-party guide/help/showcase analytics
(`GuideEvent` + beacon), which are a *customer-facing* feature (creators see
views/completion of *their* guides). The two coexist with a clear boundary
(§3).

### Goals
- Understand the acquisition → activation → retention funnel for Tacto users.
- Instrument key product events from the **authoritative source** (server for
  publish/capture/AI, client for UI intent) with a **single typed event
  taxonomy** shared across web/api/worker.
- B2B **group analytics** per workspace (plan, size, activation).
- Production-grade: reverse-proxied ingestion, consent/GDPR handling, PII
  masking, cost control, graceful no-op when unconfigured.

### Non-goals (this phase)
- Not sending **public/embedded end-user traffic** (viewers of customers'
  published guides) to PostHog — see §3.
- Not removing or reworking phase-12 first-party analytics.
- Feature flags & experiments and session replay are **phased in later** (§14, §15).

---

## 2. Why PostHog (and what we already have)

| Need | Owner | Status |
|---|---|---|
| "How many views / what completion does *this guide* get?" (shown to the creator) | phase-12 `GuideEvent` + beacon + aggregation | ✅ keep as-is |
| "What's our signup→activation funnel? feature adoption? retention? cohorts?" | **PostHog (this RFC)** | ➕ new |
| Feature flags / experiments / session replay | PostHog | later |

PostHog gives funnels, retention, cohorts, group analytics, and session replay
out of the box — none of which the bespoke phase-12 system does, and none of
which we want to hand-build.

---

## 3. Scope — which surfaces emit to PostHog (the key decision)

Tacto has four audiences. Only two are *Tacto's* users; the other two are our
customers' **end-users**. PostHog is billed per event and is about *our*
product, so:

| Surface | Route group | Audience | → PostHog? | Rationale |
|---|---|---|---|---|
| **Marketing** | `(marketing)` | prospects (anon) | ✅ yes | acquisition funnel; anon→identified on signup |
| **Dashboard / app** | `(app)`, `(auth)` | Tacto users (identified) | ✅ yes | core product analytics |
| **API** | `apps/api` | server events for our users | ✅ yes | authoritative publish/capture/team events |
| **Worker** | `apps/worker` | pipeline | ✅ yes | AI/pipeline reliability + duration analytics |
| **Public guide/help/showcase** | `/g`, `/help`, `/showcase` | *customers' end-users* | ❌ **no** | privacy (not our users), cost (unbounded), already covered by phase-12 |
| **Embeds** | `/embed/*` | *customers' end-users* | ❌ **no** | same; embeds already `noindex` + first-party tracked |

**Consequence:** PostHog init happens in the `(app)`, `(auth)`, and
`(marketing)` layouts only — **never** in `app/embed/layout.tsx`,
`app/g/**`, `app/help/**`, `app/f/**`, or `app/showcase/**`. This keeps event
volume bounded to Tacto's own user base and avoids ingesting third-party
end-user PII.

---

## 4. Architecture

```
 Browser (marketing + app only)                     Server (Railway)
 ┌───────────────────────────────┐         ┌──────────────────────────────────┐
 │ posthog-js                    │         │ apps/api      apps/worker         │
 │  init in (app)/(marketing)    │         │   │              │                │
 │  identify(userId) on login    │         │   └── @workspace/analytics/server │
 │  group('workspace', wsId)     │         │        (posthog-node, batched)    │
 │  capture(EVENT, props)        │         │        capture({distinctId=userId,│
 └──────────────┬────────────────┘         │          groups:{workspace}})     │
                │ POST /ingest/*  (same-origin, ad-blocker-proof)               │
                ▼                           └───────────────┬──────────────────┘
        Next.js rewrites  ── /ingest/* ─────────────────────┼──► PostHog Cloud (EU)
        (apps/web/next.config.ts)                            │     eu.i.posthog.com
                                                             ▼
                                    ONE distinct_id per user (better-auth user.id)
                                    → client + server events unify into one person
```

- **Single identity:** `distinct_id = better-auth user.id` everywhere. Client
  `identify()` and server `capture({ distinctId })` use the same id, so
  pre-signup anonymous marketing activity aliases onto the user and server
  events attach to the same person/session.
- **Reverse proxy:** the browser only ever talks to `tacto.fyi/ingest/*`
  (same-origin), which Next rewrites to PostHog — bypasses ad-blockers and keeps
  cookies first-party (same trick as the existing `/api` proxy).
- **Shared taxonomy:** one package (`@workspace/analytics`) defines every event
  name + property shape, imported by web (browser) and api/worker (node).

---

## 5. Identity & groups

| Concept | Value | When |
|---|---|---|
| `distinct_id` | `session.user.id` (better-auth) | on the client after `useSession` resolves → `posthog.identify(id, { email, name })`; on the server pass as `distinctId` |
| anonymous→identified | PostHog auto-aliases the pre-login anon id to the user on first `identify()` | preserves the marketing→signup funnel |
| logout | `posthog.reset()` | in the sign-out handler (`rail.tsx` `handleSignOut`, nav) |
| **group** | `posthog.group('workspace', workspaceId, { name, slug, plan, member_count })` | on workspace load + switch (`workspace-switcher` / `rail`); server mirrors via `groupIdentify` |

Groups let us build **per-workspace** funnels and B2B retention (activation is a
workspace-level question, not just a user one). `activeOrganizationId` from the
session is the group key.

`person_profiles: 'identified_only'` — anonymous marketing hits don't mint
person profiles (cost), but still power funnels; profiles are created on
`identify()`.

---

## 6. Package layout — `@workspace/analytics`

A new workspace package = the single source of truth for **event names + property
types**, plus a **server client factory**. Web uses `posthog-js` directly but
imports the same catalog.

```
packages/analytics/
├── src/
│   ├── events.ts     # typed catalog: event names + property shapes (shared)
│   ├── server.ts     # createServerAnalytics(): posthog-node wrapper (api/worker)
│   └── index.ts
├── package.json      # deps: posthog-node
└── tsconfig.json
```

**`events.ts` (shared, no runtime deps):**

```ts
// One source of truth for names + payloads. Prevents typos and drift between
// the browser, the API, and the worker.
export const ANALYTICS_EVENTS = {
  // ── Acquisition / funnel ──
  cta_clicked: "cta_clicked",                 // { location, label }
  signed_up: "signed_up",                     // { method: "email" | "google" }
  // ── Activation ──
  capture_started: "capture_started",         // { source: "extension" | "upload" }
  capture_completed: "capture_completed",     // { capture_id, step_count, duration_ms, provider, model }
  guide_created: "guide_created",             // { guide_id, from: "capture" | "import" }
  guide_published: "guide_published",         // { guide_id, mode, step_count, has_voiceover }
  guide_shared: "guide_shared",               // { guide_id, channel: "link" | "embed" | "pdf" }
  // ── Feature usage ──
  voiceover_generated: "voiceover_generated", // { guide_id, language }
  translation_generated: "translation_generated", // { guide_id, language }
  video_exported: "video_exported",           // { guide_id, language, silent }
  help_center_published: "help_center_published",
  showcase_created: "showcase_created",
  form_published: "form_published",
  // ── Team ──
  workspace_created: "workspace_created",     // { workspace_id }
  member_invited: "member_invited",           // { workspace_id, role }
} as const

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS
export type EventProps = Record<string, string | number | boolean | null | undefined>
```

Naming convention: `object_action`, `snake_case`. Every event carries
`workspace_id` and (server events) is tagged with the `workspace` group.

**`server.ts` (posthog-node, used by api + worker):**

```ts
import { PostHog } from "posthog-node"

/** Long-lived, batched PostHog client for Node services. No-ops (returns a stub)
 *  when POSTHOG_KEY is unset, so local/preview envs don't require PostHog. */
export function createServerAnalytics(key?: string, host?: string) {
  if (!key) return stub
  const client = new PostHog(key, { host, flushAt: 20, flushInterval: 10_000 })
  return {
    capture(distinctId: string, event: string, properties?: EventProps, workspaceId?: string) {
      client.capture({
        distinctId, event, properties,
        ...(workspaceId ? { groups: { workspace: workspaceId } } : {}),
      })
    },
    identify(distinctId: string, set: EventProps) { client.capture({ distinctId, event: "$identify", ...( { $set: set } as object) }) },
    groupIdentify(workspaceId: string, properties: EventProps) {
      client.groupIdentify({ groupType: "workspace", groupKey: workspaceId, properties })
    },
    shutdown() { return client.shutdown() },  // flush on SIGTERM
  }
}
```

The api and worker each construct **one** client at boot and call
`analytics.shutdown()` in their existing graceful-shutdown handlers (the worker
already has SIGINT/SIGTERM handling; the api gains one).

---

## 7. Client (web) implementation

### 7.1 Provider (init once, in the right layouts)

`components/analytics/posthog-provider.tsx` (`"use client"`):

```tsx
"use client"
import posthog from "posthog-js"
import { PostHogProvider as Provider } from "posthog-js/react"

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",                                  // reverse proxy
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,        // e.g. https://eu.posthog.com
    defaults: "2025-05-24",
    person_profiles: "identified_only",
    capture_pageview: false,                              // manual (App Router)
    capture_pageleave: true,
    autocapture: { css_selector_allowlist: undefined },   // mask sensitive nodes via .ph-no-capture
    mask_all_text: false,
    opt_out_capturing_by_default: true,                   // gated on consent (marketing) — see §11
  })
}
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY ? <Provider client={posthog}>{children}</Provider> : <>{children}</>
}
```

Mounted in **`(app)/layout.tsx`**, **`(auth)/layout.tsx`**, and
**`(marketing)/layout.tsx`** — *not* in `embed/`, `g/`, `help/`, `showcase/`.

### 7.2 Manual pageviews (App Router requires this)

`components/analytics/posthog-pageview.tsx` — `usePathname()` + `useSearchParams()`
in a `<Suspense>` boundary, `posthog.capture("$pageview", { $current_url })` on
change. (Autocapture doesn't fire pageviews on client-side nav.)

### 7.3 Identify + group

A small client island that reads `authClient.useSession()`:
- on user resolved → `posthog.identify(user.id, { email: user.email, name: user.name })`
- on active workspace resolved → `posthog.group("workspace", ws.id, { name, slug, plan })`
- on sign-out → `posthog.reset()`

### 7.4 Firing events

Components import the catalog: `posthog.capture(ANALYTICS_EVENTS.cta_clicked, { location: "hero" })`.
Client fires **intent/UI** events; **outcomes** (publish, capture-complete) fire
server-side (§8) so they're authoritative and can't be spoofed or missed if the
tab closes.

---

## 8. Server (api + worker) implementation

- **api** (`apps/api/src/lib/analytics.ts`): `createServerAnalytics(env.POSTHOG_KEY, env.POSTHOG_HOST)`. Fire on authoritative actions:
  - `signed_up` / `workspace_created` — in the better-auth `databaseHooks.user.create` / org hooks (`lib/auth.ts`).
  - `guide_published` — in `features/guide/publish-draft.ts`.
  - `guide_shared` — share/embed routers.
  - `member_invited` — the org `sendInvitationEmail` seam.
  - Also `groupIdentify(workspace, { plan, member_count })` when a workspace changes.
- **worker** (`apps/worker/src/analytics.ts`): fire pipeline outcomes with real timings already logged:
  - `capture_completed` (from `processCapture`: step_count, duration_ms, provider, model).
  - `voiceover_generated`, `translation_generated`, `video_exported` (from the respective workers).
  - failures → `capture` an event with `{ status: "failed", error }` for reliability funnels.
- Both call `analytics.shutdown()` in their SIGTERM handlers so batched events flush on deploy.

`distinctId` on the server = the acting user's id (from the authed request /
the guide's owner). Every server event tags `groups: { workspace }`.

---

## 9. Reverse proxy — `apps/web/next.config.ts`

Add PostHog rewrites **alongside** the existing `/api` rewrite (no collision):

```ts
async rewrites() {
  return [
    { source: "/api/:path*", destination: `${API_URL}/api/:path*` },   // existing
    { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
    { source: "/ingest/:path*",        destination: "https://eu.i.posthog.com/:path*" },
  ]
},
// PostHog's endpoints have trailing slashes (e.g. /e/) — don't redirect them.
skipTrailingSlashRedirect: true,
```

Notes:
- Region shown as **EU** (`eu.i.posthog.com` / `eu-assets`) — recommended given
  the GDPR posture; swap to `us` if the project is US-hosted. **This is a
  decision to lock before creating the project** (region is immovable later).
- The existing CSP (`frame-ancestors`) doesn't restrict `connect-src`, so
  same-origin `/ingest` calls are unaffected. If a stricter CSP is added later,
  allowlist `'self'`.

---

## 10. Environment variables

Graceful no-op when unset (dev/preview don't need PostHog).

| App | Var | Purpose | Example |
|---|---|---|---|
| web | `NEXT_PUBLIC_POSTHOG_KEY` | project token (public) | `phc_xxx` |
| web | `NEXT_PUBLIC_POSTHOG_HOST` | `ui_host` for links | `https://eu.posthog.com` |
| api | `POSTHOG_KEY` | same project token | `phc_xxx` |
| api | `POSTHOG_HOST` | ingest host | `https://eu.i.posthog.com` |
| worker | `POSTHOG_KEY` / `POSTHOG_HOST` | same | — |

Added to `apps/api/src/env.ts` and `apps/worker/src/env.ts` as `.optional()`
(analytics degrades to a stub when absent), and to every `.env.example` +
`DEPLOYMENT.md §4`.

---

## 11. Privacy, consent & GDPR

Non-negotiable for a product with a GDPR + cookie-policy page and EU users.

| Concern | Approach |
|---|---|
| **Consent (marketing)** | `opt_out_capturing_by_default: true`; a lightweight cookie-consent banner on `(marketing)` calls `posthog.opt_in_capturing()` on accept. Until consent, `persistence: "memory"` (no cookies). |
| **Consent (app)** | Authenticated users have accepted the ToS; capture on, with a **"Analytics" opt-out toggle in Settings → Profile** that calls `opt_out_capturing()`. Respect `navigator.doNotTrack`. |
| **PII in events** | Only send ids + coarse metadata. **Never** send guide screenshot URLs, captured text, customer content, or emails-of-third-parties as properties. |
| **Autocapture masking** | Add `.ph-no-capture` (and `data-attr` masking) to guide content, screenshots, form inputs, and the editor canvas so autocapture/replay never records customer material. |
| **Data residency** | EU project (§9). |
| **Legal** | Update `lib/marketing/legal.tsx` (`privacy`, `cookies`) to name PostHog as a processor + its cookie. |
| **DPA** | Sign PostHog's DPA; note in the GDPR page. |

---

## 12. Cost control

PostHog bills per event. Guardrails:
- **Scope** (§3) — no public/embed end-user traffic (the big one).
- `person_profiles: "identified_only"` — anon profiles aren't minted.
- Explicit high-signal events over noisy autocapture where volume is a risk;
  keep autocapture on but review the top events monthly.
- Server events batched (`flushAt: 20`, `flushInterval: 10s`).
- Optionally sample `$pageview` on marketing if volume spikes.

---

## 13. Graceful degradation & performance

- **Unset keys → no-op.** Client provider renders children without init; server
  factory returns a stub. Local dev and Vercel previews run with zero PostHog.
- `posthog-js` loads async and non-blocking; provider is a client island so the
  server tree stays RSC.
- Server client is a singleton per process; batched; flushed on shutdown.

---

## 14. Feature flags & session replay (later phases)

- **Feature flags** (phase 19.2): replace ad-hoc flags with PostHog flags,
  **bootstrapped server-side** (RSC reads flags for the user and passes them to
  the client) to avoid flicker. Enables gradual rollouts + experiments.
- **Session replay** (phase 19.3): enable **only in `(app)`** with
  `maskAllInputs: true` + block sensitive selectors; **off** on marketing and
  all public/embed surfaces. Start disabled; enable once masking is verified so
  we never record customer screenshots/PII.

---

## 15. Rollout plan

| Phase | Deliverable | Verifies |
|---|---|---|
| **19.0 — Infra** | `@workspace/analytics` pkg, env, reverse proxy, provider in the 3 layouts, identify/group/reset, manual pageviews, server factory + shutdown hooks. **No product events yet.** | pageviews + identify appear in PostHog Live; anon→identified aliases on signup |
| **19.1 — Funnel** | acquisition + activation events (client intent + server outcomes): `cta_clicked`, `signed_up`, `capture_started/completed`, `guide_created/published/shared`, `workspace_created`. | signup→first-guide→publish funnel builds in PostHog |
| **19.2 — Depth** | worker pipeline events, team events, group analytics dashboards, consent banner + settings opt-out, legal-page updates. | per-workspace retention; reliability of AI pipeline |
| **19.3 — Optional** | feature flags (server-bootstrapped), then masked session replay in `(app)`. | rollouts/experiments; qualitative debugging |

Each phase ships behind the graceful no-op, so nothing breaks if keys aren't set.

---

## 16. Verification / QA

- **Live events** view: confirm `$pageview`, `$identify`, and one custom event
  from each of web/api/worker.
- **Identity link:** browse marketing anonymously → sign up → confirm the
  pre-signup events attach to the new person (alias worked).
- **Groups:** confirm events carry the `workspace` group and a workspace shows
  its members' events.
- **No leakage:** load a public `/g/...` and an `/embed/...` page → confirm **no**
  PostHog network calls (scope holds).
- **No-op:** unset `NEXT_PUBLIC_POSTHOG_KEY` locally → app runs, zero `/ingest`
  calls, no console errors.
- **Masking:** open the editor with replay on (staging) → confirm screenshots +
  inputs are masked in the replay.

---

## 17. Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| Ad-blockers drop analytics | reverse proxy via `/ingest` (§9) |
| Double-counting vs phase-12 | different systems, different scope (§3); PostHog never sees public guide views |
| PII in replay/autocapture | masking + `.ph-no-capture` + replay off until verified (§11, §14) |
| Cost blowup | scope + `identified_only` + batching (§12) |
| Region lock-in | choose EU/US **before** project creation (§9) |
| Client/server identity mismatch | one `distinct_id` = better-auth `user.id` everywhere (§5) |

---

## 18. Decisions needed before build

1. **Region:** EU (recommended) vs US PostHog project. *(Immutable after creation.)*
2. **Session replay:** in scope for 19.3, or deferred entirely?
3. **Consent model on marketing:** opt-out-by-default + banner (recommended) vs
   assume legitimate-interest (riskier under GDPR)?
4. **Package vs inline:** ship the shared taxonomy as `@workspace/analytics`
   (recommended) or colocate constants in `@workspace/contracts`?

Once these are settled, **Phase 19.0** is a self-contained, no-op-safe PR.
