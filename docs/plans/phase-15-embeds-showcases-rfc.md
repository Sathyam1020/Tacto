# Phase 15 — Embeds & Showcases — RFC

**Status:** ✅ Shipped (2026-07-17) — Embed Foundation (phase-15 plan) + Showcases (phase-16 plan) both built on `feat/showcase-embed` · **Author:** Principal Eng · **Date:** 2026-07-16
**Scope:** `apps/web`, `apps/api`, `packages/{contracts,db,ui,storage}` · builds on the Guide Reader, the GuideEvent analytics log, the Help Center collection pattern, Forms, R2, and guide branding

---

## 1. Summary

Two related capabilities that let Tacto's guides live **off** Tacto:

- **Guide embeds** (Guidejar-parity) — drop a **single published guide** onto any website as an inline `<iframe>` or a **popup launcher**, in **List** or **Interactive** mode (no slides mode).
- **Showcases** (Supademo-parity) — bundle **multiple published guides** into a branded, standalone, shareable/embeddable collection with **three layouts** (Section · Checklist · Gallery), **autoplay + checklist progress**, and the same inline/popup embed.

Both stand on **one shared foundation**: a **chromeless embed surface** + a tiny framework-agnostic **JS loader (`embed.js`)** that renders Tacto content inside an iframe on third-party sites, with engagement flowing back through the **existing GuideEvent beacon**.

### Why this is mostly reuse

Supademo/Guidejar both work the same way under the hood: **one hosted page per id, embedded via an iframe, plus a JS loader for the popup variant.** Tacto already has the hosted player (`/g/[shareId]` = the Guide Reader) and the event beacon. So a faithful clone is **~60% composition** over what exists; the genuine net-new is the **embed layer** (chromeless routes + `embed.js` + framing headers) and the **showcase** (model + builder + the 3-layout viewer).

### Guiding principles
Reuse the Guide Reader — never a second player · one embed foundation serves both features · a showcase item **references** a published guide (never copies it) · analytics via the existing GuideEvent log · embeds are fast, framable, `noindex`, accessible · each phase ships independently green.

### Non-goals (v1 — deferred)
- **Slides-only** presentation mode (explicitly not wanted).
- **Custom domains**, **password-gated** showcases, **remove "Made with Tacto"** branding (paid-tier concerns) — the model leaves room; UI deferred.
- **Non-guide resource items** (video / PDF / link) — modeled now, shipped in the final phase.
- A published **npm/React SDK** (the `<script>` loader covers every site, including Notion/Framer/GitBook).

---

## 2. The embed foundation (shared by both features)

### 2.1 Chromeless surfaces
- **`/embed/g/[shareId]`** — one guide, no site chrome. Query: `mode=list|interactive` (defaults to the guide's `defaultView`), `lang`, `hideBranding` (reserved). Reuses `PublicGuideView` with the **`chromeless`** prop it already has (added during Help Center) + controlled mode. Published guides only; `noindex`.
- **`/embed/showcase/[slug]`** — a showcase, chromeless (Phase 5).

These are the **only** routes allowed to be framed cross-origin.

### 2.2 Framing & clickjacking (fix + enable together)
The app sets **no framing headers today** → everything is frameable (a latent clickjacking risk). We close that and open embedding in one move, via Next `headers()` / middleware:
- **App-wide:** `Content-Security-Policy: frame-ancestors 'self'` on everything **except** `/embed/*` (new clickjacking protection).
- **`/embed/*`:** `frame-ancestors *` (omit the directive) so any site can frame them. No `X-Frame-Options` (it can't express an allowlist; CSP `frame-ancestors` supersedes it).
- Embed pages: `noindex`, public-published content only, no auth required.

### 2.3 The zero-JS iframe snippet
```html
<iframe src="https://app.tacto.so/embed/g/SHAREID?mode=interactive"
        style="width:100%;aspect-ratio:16/10;border:0;border-radius:12px"
        allow="fullscreen" loading="lazy" title="Guide"></iframe>
```
Works anywhere iframes/oEmbed are accepted (Notion, Confluence, Framer, GitBook, raw HTML).

### 2.4 `embed.js` — the JS loader (inline + popup + auto-resize)
A static, dependency-free script (~few KB) served at **`https://app.tacto.so/embed.js`**:
- **Inline auto-embed** — replaces `<div data-tacto-guide="SHAREID" data-mode="list">` with an **auto-resizing** iframe.
- **Popup** — `<button data-tacto-guide-popup="SHAREID">` opens a centered **modal iframe** (backdrop + close + Esc); a **floating launcher** (`data-tacto-launcher`) pins to a corner.
- **Programmatic API** — `window.Tacto.embed(el, { guide|showcase, mode })` and `window.Tacto.open({ guide|showcase, mode })`.
- **Auto-resize** — the embedded page posts `{ type: "tacto:resize", height }` via `postMessage`; the loader sets the inline iframe height (origin-checked).
- **Showcase** — `data-tacto-showcase="SLUG"` + the Supademo-style **floating checklist countdown badge** in popup/embed contexts.

Copy-paste form:
```html
<script src="https://app.tacto.so/embed.js" async></script>
<div data-tacto-guide="SHAREID" data-mode="interactive"></div>
```

### 2.5 Analytics through the iframe (no new plumbing)
The embed is served from `app.tacto.so`, so the reader's beacon calls are **same-origin to Tacto** (no CORS). Inside the iframe, `document.referrer` is the host site → the tracker's existing logic records `referrerHost` = the embedding domain automatically, and we tag `context.source = "embed"` via the **`sourceHost`** prop already added for the Help Center. Embed views therefore appear in each guide's existing **"sources"** analytics for free.

### 2.6 Where owners get the code
An **"Embed" dialog** in the guide share menu (mirrors the existing Share dialog): a **List/Interactive** toggle, a size hint, and tabs for **Inline (iframe)** · **Inline (script)** · **Popup**, each with a copy button + a live preview.

---

## 3. Showcases

### 3.1 Data model (`packages/db/prisma/schema.prisma`)
```prisma
enum ShowcaseLayout   { SECTION CHECKLIST GALLERY }
enum ShowcaseStatus   { DRAFT PUBLISHED }
enum ShowcaseItemType { GUIDE VIDEO PDF LINK FORM }

model Showcase {                       // many per workspace (unlike Help Center)
  id, organizationId, slug @unique,    // slug unique globally
  title, description?,
  layout   ShowcaseLayout @default(CHECKLIST),
  status   ShowcaseStatus @default(DRAFT),
  autoplay Boolean        @default(true),
  brandColor?, logoUrl?, theme, seo Json?,
  publishedAt?, createdAt, updatedAt,
  sections ShowcaseSection[]
  @@index([organizationId])
}
model ShowcaseSection { id, showcaseId(→cascade), title, position, items ShowcaseItem[]  @@index([showcaseId, position]) }
model ShowcaseItem {
  id, sectionId(→cascade), position,
  type ShowcaseItemType @default(GUIDE),
  guideId?,                            // GUIDE → published Guide (rendered by the reader)
  title?, url?, formShareId?,          // VIDEO/PDF/LINK/FORM (Phase 6)
  @@index([sectionId, position])
}
```
`GUIDE` items reference a published guide; resource fields power the non-guide types later. Migration additive (3 tables + 3 enums).

### 3.2 Public viewer `/showcase/[slug]`
Branded chrome (reuse the Help Center `HelpChrome` pattern), rendering the chosen layout — each guide via the **Guide Reader** (`chromeless`/`embedded`):
- **Section** — left sidebar of sections→items; main pane renders the selected guide. Docs feel.
- **Checklist** — left checklist with a **progress bar** + per-item check state; selecting an item loads the reader; **autoplay** advances to the next incomplete item when the reader fires `complete`; a "X of N complete" header.
- **Gallery** — responsive **thumbnail grid** (guide cover / first screenshot) with a left **filter** (All · Guides · Resources); clicking opens the reader.

Per-visitor progress persists via the existing localStorage `anonId` and beacons.

### 3.3 Builder (owner)
- **List** `/(app)/showcases` — cards of showcases (many per workspace) + "New showcase". A new **rail item** ("Showcases") + a `ShowcasesPanel` second column (mirrors the Help Center panel).
- **Editor** `/(app)/showcases/[id]` — sections (add/rename/reorder), **Add guides** (reuse the Help Center published-guide picker), a **layout switcher** with preview, **autoplay** toggle, **branding** (color/logo via the Settings image proxy), SEO, dirty-gated **Publish**, and a share link + **Embed dialog** (§2.6, `data-tacto-showcase`).

### 3.4 Showcase embed
`/embed/showcase/[slug]` chromeless + the same iframe + `embed.js` popup, plus the **floating checklist countdown badge** on embeds/small screens (decrements as the viewer completes each demo — the Supademo detail).

### 3.5 Analytics
- Per-guide reads already flow via GuideEvent (source-tagged to the showcase).
- New **`ShowcaseEvent`** (mirrors `HelpCenterEvent`): `view`, `item_open`, `item_complete`, `complete`. Owner analytics tab reusing the analytics primitives: views, unique visitors, **completion rate**, per-item **popularity + drop-off**, top items.

---

## 4. Reuse map (what we do NOT rebuild)
| Need | Reuse |
|---|---|
| The player (list + interactive) | `PublicGuideView` (`chromeless`/`embedded`, controlled mode) — already exists |
| Mode toggle | `GuideBody` + `ViewModeToggle` |
| Analytics | GuideEvent beacon + `guide-tracker` (+ `sourceHost`) + the analytics aggregation & UI |
| Collection pattern | Help Center models / builder / second-column panel |
| Published-guide picker | Help Center "Add guides" |
| Branding + image upload | Settings image proxy + guide brand tokens |
| Public branded chrome | Help Center `HelpChrome` |

Net-new: `/embed/*` routes, **`embed.js`**, framing headers, the Embed dialog, and the Showcase models + builder + 3-layout viewer + `ShowcaseEvent`.

---

## 5. Phasing (commit after each; each independently green)
1. **Embed foundation + guide embed (Guidejar parity).** `/embed/g/[shareId]` (list + interactive), framing headers (lock app / open `/embed/*`), the iframe snippet, **`embed.js`** (inline + popup + floating launcher + auto-resize), the Embed dialog in the guide share menu, embed-source analytics. **Standalone shippable.**
2. **Showcase model + contracts + migration.**
3. **Showcase builder** (list + editor: sections, add guides, layout, autoplay, branding, publish).
4. **Showcase viewer** (Section · Checklist · Gallery + autoplay/checklist progress).
5. **Showcase embed** (`/embed/showcase/[slug]` + iframe + popup + floating checklist badge).
6. **Showcase analytics + resource items (video/PDF/link) + polish** (a11y, responsive, loading/empty states, docs; mark Shipped).

---

## 6. Testing
- **Unit:** checklist/progress reducers (completion + next-autoplay pick), the `data-*` embed-attribute parser, `postMessage` resize handler, showcase slug uniqueness, `ShowcaseEvent` aggregation.
- **Integration:** framing headers (embed route framable, app route not — assert response headers); `embed.js` inline + popup DOM injection (jsdom); the beacon is same-origin-to-Tacto inside the iframe.
- **Manual E2E:** paste the iframe into a blank HTML file **and** Notion → renders; popup launcher opens a modal; interactive mode works framed; showcase in all 3 layouts; autoplay advances + checks off; analytics reflect embed + showcase; publish/unpublish; responsive + keyboard; `noindex`.
- **Gate:** `turbo build typecheck lint` + api/db tests after every phase.

---

## 7. Security & performance
- **Framing allowlist** — only `/embed/*` is cross-origin framable; the rest of the app gains `frame-ancestors 'self'`.
- **`embed.js`** — no external deps, **origin-checked** `postMessage`, no `eval`, CSP-friendly, immutably cached, tiny.
- **Embed pages** — published-only, `noindex`, no auth, existing rate-limited beacon.
- **iframe** — `allow="fullscreen"`; we control the framed origin, and document how a host can add `sandbox` if desired.

---

## 8. Open questions (with recommendations)
1. **Embed host** — serve from `app.tacto.so` (simplest) vs a cookieless `embed.tacto.so` (no auth-cookie leakage into third-party iframes, better caching). *Recommendation:* ship from the app in v1; note cookieless subdomain as a fast-follow (the embed page needs no auth, so it's a clean split). Storage partitioning already isolates the iframe's `anonId` per host site — expected, not a bug.
2. **Showcase items v1** — guides-only (fastest, pure reuse) vs resources from day one. *Recommendation:* guides-only in Phases 1–5, resources in Phase 6.
3. **Visibility** — password/unlisted showcases in v1? *Recommendation:* unlisted-by-slug + `noindex` like the Help Center; password later.
4. **Branding** — keep "Made with Tacto" always-on for v1 (also marketing); make it a paid toggle later.
