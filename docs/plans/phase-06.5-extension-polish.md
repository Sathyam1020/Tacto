# Tacto — Phase 6.5: Extension polish + extension-first capture

## Context

The extension works and proves the moat, but the founder's dogfood surfaced five issues that block real use. This phase fixes them and makes the **extension the primary (only) capture path** — scrapping the screen-share recorder that was only ever a test scaffold.

Problems to fix:
1. **Connection doesn't persist.** After a recording, reopening the popup shows "Connect Tacto" again. Cause: the MV3 service worker is ephemeral — the in-memory `token`/`workspaceName` are lost on SW restart, and `GET_STATUS` races the async `chrome.storage` restore. Also `fetchMe` failure currently *drops* the token on any error (a transient blip disconnects you).
2. **Recording pill leaks into screenshots.** The floating "● Recording — Stop" pill is part of the page DOM when `captureVisibleTab` fires, so it appears in every step image. It must stay on screen for the user but be absent from captures.
3. **Navbar "Capture" still uses screen-share.** Should trigger the extension with a **tab picker** (Guidejar-style: a modal listing open tabs → pick one → record it). Remove `getDisplayMedia` entirely.
4. **App must require the extension.** If the extension isn't installed/connected, the app should gate behind an onboarding that walks the user through installing + connecting it.
5. (Implicit) Web ↔ extension needs a communication channel for #3/#4.

## Key architecture decision (flagged)

**All web↔extension comms go through a dedicated content script bridge**, not `externally_connectable` + hardcoded extension IDs. A new `app.content.ts` runs only on the Tacto app origin and:
- **announces presence + connection** to the web page (`postMessage`), so the app knows: not-installed / installed-not-connected / connected;
- **relays commands** (list-tabs, start-on-tab) between the page and the background;
- **absorbs the token relay** (merges the current `connect.content.ts`).

This needs no extension ID and no `externally_connectable` — the bridge is already injected on our own origin. Commands are origin-checked (`location.origin === WXT_APP_URL`).

## What gets built

### A. Extension (`apps/extension`)
1. **Persist connection (background.ts).** Store `token` + `workspaceName` in `chrome.storage.local`; a `ready` promise loads them once and every handler `await`s it before answering. `fetchMe` failure only disconnects on a real 401 (not transient errors). → popup shows connected forever until Disconnect.
2. **Pill out of screenshots.** `captureShot()` messages the recording tab `{PILL:false}` → awaits → `captureVisibleTab` → `{PILL:true}` (finally). `capture.content.ts` toggles the pill's `display`. Brief flicker only; pill never in the image.
3. **Record a chosen tab.** `startRecording(tabId?)` accepts a target tab (from the web picker) or falls back to the active tab. On start, `chrome.scripting.executeScript` injects the capture script into the target tab (idempotency guard via `globalThis.__tactoCaptureLoaded`) so pre-existing tabs record too; then `SET_RECORDING`.
4. **New `app.content.ts`** (matches `WXT_APP_URL/*`): announce `{type:"present", connected, workspaceName}` on load + on change; handle web→ext `list-tabs` / `start-on-tab` / `connect-token`; post responses back. Delete `connect.content.ts` (merged).
5. **Background handlers:** `LIST_TABS` (`chrome.tabs.query` → http/https tabs with `{id,title,url,favIconUrl}`), `START_ON_TAB {tabId}`, `GET_CONNECTION`. Manifest: keep `<all_urls>` for capture; no `externally_connectable` needed.

### B. Web (`apps/web`)
6. **`lib/extension.ts`** — `useExtension()` hook: listens for the bridge's presence `postMessage`; exposes `state: "unknown" | "not-installed" | "connected"` (+ workspace); helpers `listTabs()` and `startOnTab(tabId)` (postMessage round-trips with a nonce + promise).
7. **Extension gate (`(app)/layout.tsx`)** — if `state !== "connected"` after detection settles, render an **onboarding** screen instead of the app: step 1 install the extension (load-unpacked instructions / later Web Store link), step 2 "Connect" button (opens `/extension/connect`), auto-advances when the bridge reports connected. Existing `/extension/connect` page stays.
8. **Tab-picker capture (`components/capture-recorder.tsx` → rewritten as `capture-button.tsx`)** — navbar "Capture" opens a Tacto-styled modal "Choose a tab to start recording" listing `listTabs()` results (favicon + title). Pick → `startOnTab(tabId)` → toast "Recording started in that tab". Remove `use-screen-recorder.ts` and all `getDisplayMedia` code.
9. **Retire screen-share**: delete `use-screen-recorder.ts`; `capture-recorder.tsx` replaced. The `/api/captures/video` endpoints stay **dormant** (future file/Loom import) but are no longer reachable from the UI.

### C. Docs
Plan → `docs/plans/phase-06.5-extension-polish.md`.

## Deliberately out of scope
Web Store publishing, recording indicator inside the web app during capture (the on-page pill + extension badge suffice), editing which tab mid-recording, removing the dormant video endpoints.

## Order of implementation
1. Extension: persistence fix + pill-hide (fastest wins, unblock dogfood) → reload, founder re-tests connect+screenshots
2. Extension: `app.content.ts` bridge + `LIST_TABS`/`START_ON_TAB` + inject-on-start
3. Web: `useExtension` hook + presence detection
4. Web: tab-picker capture button (remove screen-share)
5. Web: extension gate/onboarding
6. Verify E2E

## Verification
1. Connect once → record → stop → reopen popup repeatedly and after ~1 min idle (SW sleep): still shows workspace + Start, never "Connect" again
2. Record a workflow → open the guide → **no recording pill in any screenshot**; pill was visible on-page during recording
3. Web navbar "Capture" → tab-picker lists real open tabs with favicons → pick one → that tab starts recording (pill appears there), even if it was open before the extension loaded
4. Fresh browser profile / disconnected: app shows the onboarding gate; can't reach home until the extension is connected; connecting auto-advances into the app
5. No `getDisplayMedia` path remains; screen-share UI gone
6. `turbo typecheck && lint && build` green (web + extension)
