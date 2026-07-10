# Tacto — Phase 6: Chrome extension (event capture, the moat)

## Context

Video capture tops out at ~70% because it guesses actions from pixels. The extension **knows**: it reads the real DOM, captures the exact element label + a crisp screenshot at the click instant, and emits the **same `captureEventSchema` events** the pipeline already consumes — so it plugs into the existing normalize → synthesize → assemble → editor → publish loop at ~95% fidelity. This is the quality the founder expected and the product's core differentiator.

Key finding: **the backend already processes EXTENSION captures.** `processCapture` runs video-ingestion only for `VIDEO_UPLOAD`; an EXTENSION capture arrives with events populated and flows straight through, and `assemble` already maps each event's `screenshotId` (an R2 key) onto `Step.screenshotUrl`. So most backend work is auth + a capture-submission flow, not new pipeline.

Research (verified today):
- **Auth = better-auth `bearer()` plugin.** `Authorization: Bearer <sessionToken>` resolves via the existing `requireAuth` (`getSession` reads it). Cookies can't cross-origin to an extension; bearer is the portable path.
- **Token handoff (one-click Connect, no second login):** a new `GET /api/extension/token` (cookie-auth) returns the current session token; a web `/extension/connect` page `postMessage`s it to a connect-only content script, which relays to the extension background. The extension never handles passwords.
- **Build framework: WXT** (v0.20) — MV3 + React + TS, entrypoint-based (background/content/popup), manifest generation, HMR, works in npm monorepos; consumes `@workspace/contracts` directly.
- **Screenshots: `chrome.tabs.captureVisibleTab`** (background only, returns a dataURL of the visible viewport; rate-limited ~2/s — fine at one-per-click). Needs `host_permissions: ["<all_urls>"]` + `tabs`.

## Architecture decisions (flagged)

- **Recording state lives in the background service worker** (+ `chrome.storage`), not the content script — content scripts die on every navigation; the SW survives and buffers events across page loads.
- **Screenshot before effect:** capture on `mousedown` (pre-click state, target still visible), associate with the following `click`. `getBoundingClientRect` (viewport coords) aligns with the visible-tab screenshot.
- **Upload on stop** (not streamed during record) — captures are short; simpler. Streaming is a later optimization.
- **Extension calls the API directly** at a configurable base (`http://localhost:4000` dev) with Bearer → API needs **CORS** for `chrome-extension://` origins + the `Authorization` header. Web app stays same-origin proxied (unchanged).
- **Chrome only, unpacked/dev load** this phase — no Web Store submission, no Firefox/Safari.

## What gets built

### 1. API (`apps/api`)
- Enable `bearer()` in `src/lib/auth.ts` (alongside `organization()`).
- `cors` middleware (new dep): allow `chrome-extension://*` + `WEB_ORIGIN`, headers incl. `Authorization`.
- `features/extension/router.ts`: `GET /api/extension/token` (requireAuth) → `{ token: req.session.token }`; `GET /api/extension/me` (requireAuth+requireWorkspace) → workspace name (popup shows where captures land).
- `features/capture/router.ts` grows (mirrors the video two-phase):
  - `POST /api/captures/extension` {title?} → create Capture (EXTENSION, UPLOADING) → `{ captureId }`
  - `POST /api/captures/:id/screenshot-urls` {count} → `{ urls: [{key, uploadUrl}] }` (batch presign, `captures/<org>/<id>/shots/<n>.png`)
  - `POST /api/captures/:id/submit` { events } → validate, set events, PROCESSING, enqueue (events carry `screenshotId` = the keys)

### 2. Web (`apps/web`)
- `app/extension/connect/page.tsx` — client; if signed in, fetch token, `postMessage({source:"tacto-extension", token, apiBase}, origin)`, show "Connected — close this tab"; if not, redirect to sign-in and back.
- `.env`: `NEXT_PUBLIC_APP_URL` already present; expose API base for the connect payload.

### 3. Extension (`apps/extension`, new — WXT + React)
- `wxt.config.ts`: MV3, permissions `activeTab, tabs, scripting, storage`, `host_permissions: ["<all_urls>"]`, `externally_connectable`/content-match for the connect page. Env: `WXT_API_BASE`, `WXT_APP_URL`.
- **`entrypoints/background.ts`** — the recorder brain: start/stop, buffer events + screenshots in memory + `chrome.storage`, `captureVisibleTab` on request, badge "REC", on stop run the upload+submit flow, store/clear the bearer token, receive token from the connect relay.
- **`entrypoints/capture.content.ts`** (matches `<all_urls>`) — listens for click/mousedown/input/blur/navigation; builds each event (`selector`, `role`, visible `text` label, `boundingBox`, `nearbyContext`; passwords → `•••`; coalesce keystrokes → one input on blur); posts to background; renders a floating "● Recording — Stop" pill when active.
- **`entrypoints/connect.content.ts`** (matches the connect URL) — reads the `postMessage` token, relays to background.
- **`entrypoints/popup/`** (React) — Connect state (button opens the connect tab; shows workspace when connected), Start/Stop capture, "processing — open in Tacto" link after stop. Styled to the Tacto system (reuse tokens/wordmark).
- **`lib/`** — `selector.ts` (robust CSS selector + label extraction), `api.ts` (Bearer fetch to the capture endpoints), event types imported from `@workspace/contracts/capture`.
- Icons: the touch-ring mark (16/48/128 png).

### 4. Wiring
- Root `package.json`/turbo: extension `dev`/`build` scripts (WXT). turbo `globalEnv` += `WXT_API_BASE`, `WXT_APP_URL`.
- Plan → `docs/plans/phase-06-extension.md`.

## The capture event contract (already exists — extension fills it)
`click`/`input`/`navigation` with `timestamp`, `url`, `pageTitle`, `target {selector, role, text, boundingBox, nearbyContext}`, `value` (masked), `screenshotId` (R2 key). No `confidence` (extension = trusted) → no "review" badges, unlike video.

## Order of implementation
1. docs + API (bearer, cors, extension token, capture submit endpoints) — verify Bearer end-to-end with curl first
2. web connect page
3. extension scaffold (WXT + React) + popup + connect relay → prove token handoff
4. capture content script (selector/label/bbox, coalescing, masking) + background recorder + screenshots
5. upload + submit flow → guide appears in web app
6. recording pill/badge polish
7. verify E2E

## Verification (end-to-end)
1. curl: `GET /api/extension/token` with a cookie → token; reuse it as `Authorization: Bearer` on `GET /api/me` → 200 (proves bearer before any extension code)
2. Load unpacked extension → popup → Connect → opens web, returns "Connected"; popup shows the active workspace
3. Start capture on a real site (e.g. GitHub settings), do ~6 actions incl. a text field, Stop → screenshots upload, submit succeeds
4. Web app home shows the processing card → becomes a guide with **real element labels + crisp per-step screenshots**, no "review" badges
5. Founder quality gate: steps materially better than the video path (the whole point)
6. Password field captured as `•••`; navigation becomes a step; rapid typing = one input step
7. Cross-workspace/auth: bad/absent token → 401; switching workspace in web → new captures land in the new one
8. `turbo typecheck && lint && build` green (extension included)

## Deferred
Interactive walkthrough replay on live sites (hotspots), Web Store submission, Firefox/Safari, Google-OAuth-in-extension (Connect flow avoids it), streamed uploads, multi-tab recording, desktop app.
