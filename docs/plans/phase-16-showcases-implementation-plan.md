# Phase 16 — Showcases — Implementation Plan

**Status:** Proposed (plan-only; awaiting go-ahead to build) · Implements the **Showcase** half of `phase-15-embeds-showcases-rfc.md`
**Branch:** `feat/showcase-embed` · **Scope:** `apps/web`, `apps/api`, `packages/{contracts,db,ui,storage}`

> A Showcase is a Supademo-style **curated, branded, embeddable collection** of a workspace's content — guides **and** resources (video · PDF · link · form) — organized into sections and presented in one of three layouts (Section · Checklist · Gallery), with autoplay/checklist progress. **Many per workspace** (unlike the one-per-workspace Help Center). It reuses the Guide Reader, the **Embed Foundation** (Phase 15), the Help Center collection patterns, branding/uploads, and the GuideEvent analytics. **Decision locked:** guides + resources ship from day one.

---

## 1. Architecture

```
Owner (builder)                     Public                          Embed (reuses Phase 15)
──────────────                      ──────                          ───────────────────────
/(app)/showcases        ──publish──► /showcase/[slug]  ◄──iframe──  /embed/showcase/[slug]
  Sections → Items                    layout: Section|Checklist|      + embed.js popup
  (guide | video | pdf                        Gallery                 + floating checklist badge
   | link | form)                     item renderer per type
  layout · autoplay · brand           progress + autoplay             ShowcaseEvent + guide reads
                                      ShowcaseEvent beacon             (source="showcase:slug")
```

- **Item renderer** switches by type: `GUIDE → PublicGuideView` (chromeless), `VIDEO → <video>/provider iframe`, `PDF → iframe`, `LINK → card → new tab`, `FORM → the existing public form fill`. Guides are **referenced, never copied**.
- **Embed is free**: `/embed/showcase/[slug]` reuses the Phase-15 framing headers + `embed.js` (`data-tacto-showcase`, popup, auto-resize, events). The floating **checklist countdown badge** is the one new embed affordance.
- **Analytics reuse**: per-item guide reads flow through `GuideEvent` tagged `source="showcase:{slug}"` (via the reader's `source` prop, Phase 15). Showcase-level engagement (view/item_open/item_complete/complete) uses a new `ShowcaseEvent` mirroring `HelpCenterEvent`.

---

## 2. Data model (`packages/db/prisma/schema.prisma`) — additive

```prisma
enum ShowcaseLayout    { SECTION CHECKLIST GALLERY }
enum ShowcaseStatus    { DRAFT PUBLISHED }
enum ShowcaseItemType  { GUIDE VIDEO PDF LINK FORM }
enum ShowcaseEventType { VIEW ITEM_OPEN ITEM_COMPLETE COMPLETE CONTACT_CLICK }

model Showcase {                        // MANY per workspace
  id, organizationId, slug @unique,     // slug unique globally → /showcase/{slug}
  title, description?,
  layout   ShowcaseLayout @default(CHECKLIST),
  status   ShowcaseStatus @default(DRAFT),
  listed   Boolean        @default(true),   // noindex until published + listed (mirror Help Center)
  autoplay Boolean        @default(true),
  brandColor?, logoUrl?, theme @default("system"), seo Json?,
  publishedAt?, createdAt, updatedAt,
  organization Organization @relation(fields:[organizationId], references:[id], onDelete: Cascade)
  sections ShowcaseSection[]
  events   ShowcaseEvent[]
  @@index([organizationId])
}
model ShowcaseSection {
  id, showcaseId, title, position, hidden Boolean @default(false),
  showcase Showcase @relation(onDelete: Cascade)
  items ShowcaseItem[]
  @@index([showcaseId, position])
}
model ShowcaseItem {
  id, sectionId, position,
  type ShowcaseItemType @default(GUIDE),
  guideId?,                 // GUIDE → published Guide (onDelete: Cascade removes the item)
  title?,                   // display label (falls back to guide title / filename)
  url?,                     // VIDEO/PDF/LINK: external URL or an /api/img proxy URL (R2)
  formShareId?,             // FORM → an existing published form
  createdAt
  section ShowcaseSection @relation(onDelete: Cascade)
  guide   Guide?          @relation(fields:[guideId], references:[id], onDelete: Cascade)
  @@index([sectionId, position])
}
model ShowcaseEvent {
  id, showcaseId, type ShowcaseEventType, anonId?, sessionId?, target?, createdAt
  showcase Showcase @relation(onDelete: Cascade)
  @@index([showcaseId, type, createdAt])
}
```
Back-relations: `Organization.showcases`, `Guide.showcaseItems`. Migration `add_showcase` (5 enums/tables + indexes; empty-table safe → `migrate dev --create-only` + `migrate deploy` per the sandbox convention).

---

## 3. Resource handling (the "from day one" scope)

| Type | Stored as | Rendered by |
|---|---|---|
| **GUIDE** | `guideId` (published guide) | `PublicGuideView` (chromeless, `source="showcase:{slug}"`) |
| **VIDEO** | `url` — external (YouTube/Loom/Vimeo/mp4) **or** an R2 upload proxy URL | provider `<iframe>` (detected) or `<video controls>` for mp4/R2 |
| **PDF** | `url` — external or R2 upload proxy URL | `<iframe>` viewer + "Open" fallback |
| **LINK** | `url` — external | a card that opens in a new tab (`rel="noopener"`) |
| **FORM** | `formShareId` (published form) | the existing public **form fill** component |

**Uploads (video/PDF):** reuse the existing `/api/img/*` proxy — it redirects to a presigned R2 URL and R2 serves the stored content-type, so it's **already content-type-agnostic** (works for video/pdf, not just images). Extend `POST /api/uploads/image` → a generalized `POST /api/uploads` accepting `image/* · video/mp4 · application/pdf` with per-type size caps; keys stay under the proxy-served prefix. External URLs need no upload. A tiny URL-provider helper (`youtube|loom|vimeo|mp4|other`) picks the video renderer.

---

## 4. Route structure (deep-linkable)

| Route | Purpose |
|---|---|
| `/(app)/showcases` | Owner list of showcases (cards) + "New showcase" |
| `/(app)/showcases/[id]` | Owner editor (sections · items · layout · design · settings · analytics) |
| `/showcase/[slug]` | Public viewer (SSR, branded, chosen layout, `noindex` until published+listed) |
| `/embed/showcase/[slug]` | Chromeless viewer for iframing (reuses Phase-15 framing) |

Rail gains a **"Showcases"** item; the app-shell renders a **`ShowcasesPanel`** (2nd column) on `/showcases`, mirroring the Help Center panel.

---

## 5. Component hierarchy

```
app/(app)/showcases/page.tsx              → list (cards) + create
app/(app)/showcases/[id]/page.tsx         → editor (tabs: Content · Design · Settings · Analytics)
components/app-shell/showcases-panel.tsx  → 2nd-column nav (showcase list + New)
components/showcase/
  builder/*        → SectionList, ItemRow, AddItemMenu (guide picker + resource forms),
                     LayoutPicker, AutoplayToggle, BrandPanel, PublishBar, ShareEmbed
  view/
    showcase-view.tsx      → chrome + layout switch + progress/autoplay controller
    layout-section.tsx     → sidebar + content pane
    layout-checklist.tsx   → progress list + sequential + autoplay
    layout-gallery.tsx     → thumbnail grid + filter
    item-renderer.tsx      → switch(type) → guide/video/pdf/link/form
    checklist-badge.tsx    → floating countdown (embed/small screens)
app/showcase/[slug]/page.tsx              → SSR public (fetch + <ShowcaseView>)
app/embed/showcase/[slug]/page.tsx        → chromeless + EmbedBridge (reuses Phase 15)
```

Reused verbatim: `PublicGuideView`, the Help Center `HelpChrome`, the published-guide **picker**, `ImageUpload`, analytics `Panel/StatCard/BarRow/TrendChart`, `embed.js` + `EmbedBridge`.

---

## 6. Public viewer — the three layouts

- **Section** — left sidebar of sections→items; main pane renders the selected item. Docs/browse feel.
- **Checklist** — left checklist with a **progress bar** + per-item check state; selecting loads the item; **autoplay** advances to the next incomplete item when a guide fires `complete` (or a video ends); a "X of N complete" header. Progress persists per-visitor (localStorage `anonId`, same as reactions) and beacons `ITEM_COMPLETE`/`COMPLETE`.
- **Gallery** — responsive **thumbnail grid** (guide cover / first screenshot / resource thumb) with a left **filter** (All · Guides · Videos · PDFs · …); clicking opens the item (route or modal).

All three share the branded chrome (reuse `HelpChrome`), the item renderer, and the progress/autoplay controller. Theme + the Phase-15 `theme=light|dark|auto` apply in the embed variant.

---

## 7. Builder (owner)

- **List** (`/showcases`): cards (title, item count, layout, status) + "New showcase" (creates a draft, opens the editor).
- **Editor** (`/showcases/[id]`): tabs —
  - **Content**: sections (add/rename/reorder/hide), per-section items with drag reorder; **Add item** menu → *Add guides* (the Help Center picker) · *Add video* (URL or upload) · *Add PDF* (URL or upload) · *Add link* · *Add form* (form picker).
  - **Design**: layout switcher (Section/Checklist/Gallery, live preview) · autoplay toggle · brand color + logo (image proxy) · theme.
  - **Settings**: slug (collision-checked), listed/visibility, SEO.
  - **Analytics**: the roll-up (see §9).
  - Navbar: dirty-gated **Publish** + a **Share/Embed** dialog (reuses the Phase-15 embed snippets with `data-tacto-showcase`).

---

## 8. Contracts (`packages/contracts/src/showcase.ts`, subpath export)

Enums (`ShowcaseLayout/Status/ItemType`), `createShowcaseSchema`, `updateShowcaseSchema` (title/description/layout/autoplay/brand/theme/seo/slug/listed), `reorderSchema`, section CRUD, `showcaseItemSchema` (discriminated by type: guide/video/pdf/link/form), upload schema (extend Phase-15 image schema to video/pdf), public payloads (`PublicShowcase`, `PublicShowcaseSection`, `ShowcaseItemPayload`), analytics event schema + `ShowcaseAnalytics`.

---

## 9. API surface

**Owner** (`features/showcase/router.ts`, auth + workspace):
- `GET /api/showcases` (list) · `POST` (create) · `GET/PATCH/DELETE /api/showcases/:id` (detail/settings/delete) · `POST /api/showcases/:id/publish`.
- Sections: `POST/PATCH/DELETE …/sections[/:id]` + `…/sections/reorder`.
- Items: `POST …/sections/:id/items` (guide/resource) · `PATCH/DELETE …/items/:id` · `…/items/reorder`.
- `GET /api/showcases/:id/available-guides?q=` (picker) · `GET /api/showcases/:id/analytics?range=`.

**Public** (`features/public/showcase-router.ts`, by slug, no auth):
- `GET /api/public/showcase/:slug` (viewer payload: chrome + sections + resolved items; guide items carry the guide `shareId`).
- `POST /api/public/showcase/:slug/events` (beacon — mirrors the help-center beacon).

**Uploads:** generalize `features/uploads/router.ts` to `POST /api/uploads` (image/video/pdf).

---

## 10. Analytics (reuse GuideEvent + a small ShowcaseEvent)

- **Per-item guide reads** already flow via GuideEvent; the showcase reader passes `source="showcase:{slug}"` (Phase-15 `source` prop keeps the real referrer + tags the surface). So the guide's own analytics reflect showcase traffic for free.
- **Showcase-level** `ShowcaseEvent` (`useShowcaseTracker`, mirrors `useHelpTracker`): `view`, `item_open` (target=item id/type), `item_complete`, `complete`, `contact_click`. Pure `computeShowcaseAnalytics` (mirrors `computeHelpAnalytics`) → the Analytics tab: views, unique visitors, **completion rate**, per-item **opens + completion (drop-off)**, top items, video vs guide engagement.

---

## 11. Permission & security
- Owner routes are workspace-scoped (`requireAuth` + `requireWorkspace`); all owners in a workspace can manage its showcases (no per-showcase roles in v1).
- Public viewer: published-only content; `noindex` until published + listed (reuse the Help Center gate). Embed reuses the Phase-15 framing allowlist.
- Resource URLs: `LINK`/external `VIDEO`/`PDF` are owner-authored; render external links with `rel="noopener noreferrer"`; PDFs/videos in sandboxed iframes where external.

---

## 12. Testing
- **Pure/unit:** slug uniqueness; the progress/autoplay reducer (next-incomplete pick, completion %); the video-provider detector (youtube/loom/vimeo/mp4/other); `showcaseItemSchema` discriminated validation; `computeShowcaseAnalytics`.
- **API:** item CRUD by type + reorder; publish; available-guides; generalized upload mime/size; the public payload resolves guide shareIds + resource URLs.
- **Manual E2E:** create showcase → add sections → add guides + a video + a PDF + a link + a form → reorder → pick each layout → autoplay/checklist advances + checks off → publish → `/showcase/[slug]` in all 3 layouts → embed (iframe + popup + floating badge) → analytics reflect views/item-opens/completion + guide `source=showcase` → unpublish → responsive + a11y + `noindex`.
- **Gate:** `turbo build typecheck lint` + api/db tests after every phase.

---

## 13. Rollout (commit after each; each independently green)
1. **Model + contracts + migration.** Schema (5 enums/tables) + `showcase` contracts + migration.
2. **Owner APIs.** CRUD, sections, items (all 5 types), reorder, publish, available-guides, analytics; generalize uploads to video/pdf. Tests.
3. **Owner builder.** Rail item + `ShowcasesPanel`; list + editor (Content/Design/Settings) incl. the Add-item menu (guides + resource forms); dirty-gated publish + Share/Embed.
4. **Public viewer.** SSR `/showcase/[slug]` + the 3 layouts + item renderers (guide/video/pdf/link/form) + progress/autoplay + chrome/branding + SEO.
5. **Showcase embed + analytics.** `/embed/showcase/[slug]` + `data-tacto-showcase` in embed.js + floating checklist badge; `ShowcaseEvent` + `useShowcaseTracker` + guide `source` attribution + the Analytics tab.
6. **Polish.** a11y, responsive, loading/empty states, sitemap/robots, docs; mark the RFC + this plan Shipped.

---

## 14. Files (indicative)
- **db:** `schema.prisma`, `migrations/*_add_showcase/`.
- **contracts:** `src/showcase.ts` (+ subpath).
- **api:** `features/showcase/{router,analytics}.ts` + tests, `features/public/showcase-router.ts`, `features/uploads/router.ts` (generalize), `app.ts` mounts.
- **web (owner):** `app/(app)/showcases/…`, `components/showcase/builder/*`, `components/app-shell/showcases-panel.tsx`, rail wiring, `lib/showcase.ts`.
- **web (public):** `app/showcase/[slug]/…`, `app/embed/showcase/[slug]/…`, `components/showcase/view/*`, `lib/public-showcase.ts`, `lib/showcase-tracker.ts`.

---

## 15. Open items (non-blocking; sensible defaults chosen)
1. **Video hosting** — support external URLs + R2 upload (both). Recommendation: ship both; the `/api/img` proxy already serves any content-type, so uploads are cheap.
2. **Gallery thumbnails** — guide cover / first screenshot for guides; a provider thumbnail or a generated frame for videos; an icon for PDF/link/form. Recommendation: reuse existing guide covers; icon placeholders for resources in v1, richer thumbs later.
3. **Password/unlisted** — unlisted-by-slug + `noindex` in v1 (like Help Center); password later.
4. **"Made with Tacto"** — always-on in v1 (also marketing).
