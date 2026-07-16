# Phase 15 — Embed Foundation — Implementation Plan

**Status:** In progress · **Source of truth for build** · Companion to `phase-15-embeds-showcases-rfc.md`
**Branch:** `feat/showcase-embed` · **Scope:** `apps/web`, `apps/api`, `packages/{contracts,ui}`

> Lives in `docs/plans/` beside the RFC + the phase-11→14 plans (the established location).
> **Embed Foundation only** — Showcases are explicitly out of scope for this build (the RFC's showcase phases come later). This ships the ability to embed a **single published guide** on any site, plus the redesigned Share/distribution hub and the removal of publishing from the editor.

---

## 0. Two approved architectural changes (land in Phase 3)

1. **The Guide Editor authors only — no publishing.** Remove the editor's **"Update guide"** button (`app/(app)/guides/[id]/edit/page.tsx:1001`, `usePublishDraft`) and every publish/visibility control from the editor. The editor autosaves the **draft**; making changes live and all distribution move to the **Guide Details page** via the Share hub.
2. **The Share dialog becomes the single distribution hub** (replacing `share-dialog.tsx`'s toggle-only UI and every other publish entry point). Grouped as:
   - **Distribution** — Public Guide (Draft/Public visibility), Copy Public Link, QR Code
   - **Developer** — iframe, Script Embed, Popup Embed
   - **Content Hubs** — Add to Help Center · Add to Collection *(future/disabled)*

These are **UX consolidation**, not a change to the draft/publish data model (`usePublishDraft` = push content live; `usePublishGuide` = visibility DRAFT↔PUBLISHED both remain; they're just relocated + surfaced through the hub).

---

## 1. Architecture

```
Third-party site                          app.tacto.so
────────────────                          ─────────────
<iframe src="/embed/g/ID">  ───────────►  /embed/g/[shareId]  (chromeless PublicGuideView)
   or embed.js                                  │ renders reader (list | interactive), theme
   ├─ inline  → injects iframe                   │ fires GuideEvent beacon (same-origin)
   ├─ popup   → modal iframe                      │ postMessage → parent: ready/step_change/complete/resize/error
   └─ Tacto.* SDK  ◄── postMessage (origin-checked) ──┘
```

- **The player is the existing Guide Reader** (`PublicGuideView`, already has `chromeless` + controlled `mode`/`lang` from Help Center). No second player.
- **The embed is a hosted page framed by an iframe.** `embed.js` only injects/ą controls iframes + relays events; it never renders guide content itself.
- **Analytics are same-origin** (the iframe is served by Tacto) → the existing GuideEvent beacon + `sourceHost` tagging works with no new pipeline.
- **Domain-agnostic:** the Share dialog builds URLs from `window.location.origin`; `embed.js` derives its base from its own `<script src>` origin. Nothing hardcodes a domain.

---

## 2. Route structure

| Route | Purpose | Framing |
|---|---|---|
| `/embed/g/[shareId]` | Chromeless single-guide reader for iframing. Query: `mode=list\|interactive`, `theme=light\|dark\|auto`, `lang`. Published-only, `noindex`. | framable anywhere |
| `/embed.js` | The SDK loader (served as a static route with long cache). | n/a |
| `/g/[shareId]` | Existing hosted reader (unchanged). | `frame-ancestors 'self'` |
| everything else | The app. | `frame-ancestors 'self'` (new clickjacking protection) |

---

## 3. Framing / security headers (Phase 1)

Add response headers via `apps/web/next.config.ts` `headers()` (or `middleware.ts`):
- **`/embed/:path*`** → `Content-Security-Policy: frame-ancestors *` (no `X-Frame-Options`). Also `X-Robots-Tag: noindex`.
- **`/:path*` (everything else)** → `Content-Security-Policy: frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`.
- `embed.js` → `Cache-Control: public, max-age=…, immutable` (versioned) and permissive CORS is unnecessary (it's a script tag, not fetched cross-origin).

---

## 4. `embed.js` — reusable SDK (Phase 2)

A dependency-free UMD/IIFE script exposing `window.Tacto`. The base origin is inferred from the executing `<script>`'s `src`.

**Public API (leave room for more):**
```ts
Tacto.embed(target, opts)   // inline: mount an iframe into target (Element | selector). → instance
Tacto.open(opts)            // popup: open a modal iframe. → instance
Tacto.close(instance?)      // close a popup (or the most recent)
Tacto.destroy(instance?)    // tear down an embed/popup + its listeners
Tacto.on(event, handler)    // subscribe (global or per-instance via instance.on)
Tacto.off(event, handler)   // unsubscribe
// opts: { guide: shareId, mode?: "list"|"interactive", theme?: "light"|"dark"|"auto", height?: number }
```

**Auto-init (declarative):** on `DOMContentLoaded`, scan for:
- `[data-tacto-guide]` (+ `data-tacto-mode`, `data-tacto-theme`) → inline embed.
- `[data-tacto-guide-popup]` on a clickable → opens a popup on click.

**Instance handle:** `{ id, iframe, on(evt,fn), off(evt,fn), close(), destroy() }`.

**Popup:** centered modal iframe + backdrop + close button + `Esc`; focus-trapped; `role="dialog"`; restores focus on close.

**Copy-paste forms the Share dialog emits:**
```html
<!-- iframe -->
<iframe src="…/embed/g/ID?mode=interactive" style="width:100%;aspect-ratio:16/10;border:0" allow="fullscreen" loading="lazy"></iframe>
<!-- script (inline) -->
<script src="…/embed.js" async></script>
<div data-tacto-guide="ID" data-mode="interactive"></div>
<!-- popup -->
<script src="…/embed.js" async></script>
<button data-tacto-guide-popup="ID">Show me how</button>
```

---

## 5. postMessage protocol (Phase 2, origin-checked)

**iframe → parent** (`{ source: "tacto-embed", v: 1, id, type, ...payload }`):
| type | payload | when |
|---|---|---|
| `READY` | `{ shareId, mode }` | reader mounted |
| `RESIZE` | `{ height }` | content height changes (ResizeObserver) |
| `STEP_CHANGE` | `{ index, total }` | list step in view / interactive frame changes |
| `COMPLETE` | `{}` | reader fires completion |
| `ERROR` | `{ message }` | load/render error |

**parent → iframe** (`{ source: "tacto-embed-host", v: 1, type }`) — reserved for future (`SET_THEME`, `SET_MODE`, `GO_TO_STEP`); wire the receiver now, no-op unknowns.

**SDK → app listeners** (via `on`/`off`): `ready`, `open`, `close`, `step_change`, `complete`, `error`, `resize`. (`open`/`close` are SDK-lifecycle for popups; the rest re-broadcast iframe events.)

**Origin checks:** the SDK ignores any message whose `event.origin` ≠ the embed base origin and whose `source` ≠ `"tacto-embed"`. The embed page ignores host messages whose `source` ≠ `"tacto-embed-host"`. Both validate the shape.

---

## 6. Reader-side changes

- **Chromeless embed page** (Phase 1): `/embed/g/[shareId]` renders `<PublicGuideView guide chromeless mode={mode} lang={lang} sourceHost="embed" />` inside a theme wrapper honoring `theme=light|dark|auto`.
- **Event emitter** (Phase 2): a small `useEmbedBridge()` hook (active only when framed) that posts `READY` on mount, `RESIZE` via `ResizeObserver`, `STEP_CHANGE`/`COMPLETE` off the reader's existing tracker signals, and `ERROR` from an error boundary. Reuses the tracker's step/complete detection so there's no duplicate logic.
- **Theming** (Phase 1 plumbing): the embed wrapper applies `.dark` / light / `prefers-color-scheme` based on `theme`.

---

## 7. Share / distribution hub (Phase 3)

Rebuild `share-dialog.tsx` into a tabbed hub used from the **Guide Details page** (and guide cards):
- **Distribution:** visibility Switch (Draft/Public via `usePublishGuide`) · Copy Public Link · **QR Code** (download PNG + inline SVG).
- **Developer:** three copy-boxes (iframe / script / popup) with a **List/Interactive** mode toggle + live preview, generated from `window.location.origin`.
- **Content Hubs:** "Add to Help Center" (reuse existing help-center placement) · "Add to Collection" (disabled/"soon").
- **Editor cleanup:** delete the editor's "Update guide"/publish button + relocate "publish changes" to the Details page; remove `ShareDialog`/publish imports from the editor.

QR: add a small dep (`qrcode`) or a pure-SVG generator; render client-side, downloadable.

---

## 8. Analytics (reuse GuideEvent — no new pipeline)

- The embed reader passes **`sourceHost="embed"`** → the tracker sets `context.source`/`referrerHost`. Inside the iframe `document.referrer` = the host site, so the embedding domain is captured automatically.
- Tracked (all already emitted by the reader): **view** (source=embed, referrerHost, mode via `mode_switch`), **complete**. No schema change — `guideEventContextSchema` already has `referrerHost`; add an optional `source` field if not present.
- Surfaces in the guide's existing analytics "sources" + mode/completion widgets for free.

---

## 9. Files to touch / add
- **web (embed):** `app/embed/g/[shareId]/page.tsx` (new), `app/embed/layout.tsx` (new, chromeless + theme), `public/embed.js` **or** `app/embed.js/route.ts` (SDK), `components/embed/embed-bridge.tsx` (postMessage emitter), `next.config.ts` (headers).
- **web (share hub):** `components/share-dialog.tsx` (rebuild), `components/guide/qr-code.tsx` (new), `app/(app)/guides/[id]/page.tsx` (Details = distribution home), `app/(app)/guides/[id]/edit/page.tsx` (remove publish button + share/publish imports).
- **contracts:** `guide-analytics.ts` (add optional `source` to context if missing).
- **ui:** possibly `tabs` (exists) for the hub.
- **deps:** `qrcode` (QR) — the one new dependency, justified by the required feature.

---

## 10. Rollout (commit after each; each independently green)
1. **Phase 1 — Embed route + framing + iframe.** `/embed/g/[shareId]` (chromeless reader, `mode`/`theme`/`lang`, `noindex`), framing headers (lock app / open `/embed/*`), verify a raw `<iframe>` renders + analytics still beacon. **Standalone: iframe embeds already work.**
2. **Phase 2 — `embed.js`.** SDK (`embed`/`open`/`close`/`destroy`/`on`/`off`), inline auto-embed, popup launcher, auto-resize, the postMessage protocol + origin checks, reader-side `useEmbedBridge`.
3. **Phase 3 — Share/distribution hub.** Rebuild the Share dialog (Distribution/Developer/Content Hubs), visibility, public link, QR code, embed snippets + preview; **remove publishing from the editor**, make Details the distribution home.
4. **Phase 4 — Analytics + SDK polish + a11y + docs.** `source=embed` end-to-end, SDK hardening (error states, multiple instances, cleanup), popup a11y (focus trap, Esc, reduced motion), responsive, an embed docs page, mark Shipped.

---

## 11. Testing
- **Unit:** `embed.js` attribute parser (`data-*` → opts), postMessage origin/shape guard, URL builder (origin + params), QR data-URL generation, analytics `source` mapping.
- **Integration:** framing headers (assert `/embed/*` framable + app not, via response headers); `embed.js` inline + popup DOM injection + resize (jsdom); the reader emits `READY`/`COMPLETE`.
- **Manual E2E:** paste each snippet (iframe / script / popup) into a blank `.html` file **and** Notion → renders; interactive mode works framed; popup opens/closes (Esc, backdrop, focus); auto-resize tracks content; theme light/dark/auto; guide analytics show `source=embed` + referrer; editor has no publish button; Details/Share hub publishes + copies + QR; `noindex`.
- **Gate:** `turbo build typecheck lint` + api/db/web tests after **every** phase.

---

## 12. Security
- Framing allowlist: only `/embed/*` cross-origin; rest `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`.
- `embed.js`: no deps, no `eval`, origin-checked `postMessage` both directions, immutable cache, base derived from its own src.
- Embed pages: published-only, `noindex`, no auth, existing rate-limited beacon; storage-partitioned `anonId` in third-party iframes is expected.
- Popup iframe: `allow="fullscreen"`; document host-side `sandbox` option.

---

## 13. Open items
- **QR dependency** — add `qrcode` (or a tiny pure generator). Confirm acceptable (it's a required feature).
- **Embed host** — served from the app in v1 (RFC §8); cookieless `embed.` subdomain is a later optimization.
- **`source` context field** — add to `guideEventContextSchema` if not already present (small additive contract change).
