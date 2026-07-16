# Phase 13 — Help Center — Implementation Plan

**Status:** ✅ Shipped (Phases 1–7 complete) · **Source of truth for build** · Companion to `phase-13-help-center-rfc.md`
**Branch:** `feat/help-center` · **Scope:** `apps/web`, `apps/api`, `packages/{contracts,db,ui}`

> Convention note: lives in `docs/plans/` beside the RFC + the phase-11/12 plans (the established location).
> A **Help Center article is ALWAYS a published Guide.** No new editor, no duplicated rendering, no duplicated branding/analytics. The Help Center adds only: organization, branding, navigation, search, discovery.

---

## 0. Approved refinements (fold into every phase)

1. **Content tab = article _cards_, not table rows** — each card shows **title · read-time · status · Featured badge · drag handle**. Visual, not CRUD.
2. **Collections support** rename · **duplicate** · **hide** · delete · **drag reorder** → adds `HelpCollection.hidden Boolean @default(false)` + a duplicate API action.
3. **Keyboard:** `/` focuses search, `⌘K` opens command search (builder + public).
4. **Guide editor shows "Published In"** — a small section listing the collections (+ "Featured") a guide appears in, with **Open Help Center →**. Read-only reverse lookup; never a second editor.
5. **Status URL = optional/future** — keep the field, deprioritize the UI (a Settings row, not a launch blocker).

Locked-out (do NOT build): another guide system, duplicate rendering/branding/analytics, AI search, custom domains, multiple help centers, widgets.

---

## 1. Architecture summary

```
Published Guide ──(HelpArticle: ordering + featured)──► HelpCollection ──► HelpCenter (one per workspace)
       │                                                                          │
       └── rendered by the EXISTING Guide Reader (PublicGuideView) ◄── public /help/{slug}/... routes
                     (walkthrough, voiceover, FAQs, forms, PDF, translations, analytics all automatic)
```

- **One `HelpCenter` per workspace** (`@@unique organizationId`). Draft → Publish mirrors guides/forms (a `status` + `publishedAt`; the public site reads published state).
- **Reuse, do not rebuild:** the Guide Reader renders articles verbatim (every reader feature works for free); **branding** reuses the guide brand tokens/controls; **draft/publish** reuses the editor navbar + dirty-gating pattern; **analytics** reuses the `GuideEvent` beacon/log (+ a few help-center event types); **forms** power "Submit a request"; **UI primitives** (`RailButton`, `ViewRow`, `Panel`, `Button`, `DropdownMenu`, `Dialog`, `CommandPalette`, `TrendChart`) are reused.
- **Public serialize reuses the guide public serialize** (`features/guide/serialize.ts` + the public router's guide payload) so an article page is the guide reader inside help-center chrome.

---

## 2. Database changes (`packages/db/prisma/schema.prisma`)

Additive; three models + two back-relations. (Full DDL in the RFC §2; deltas from RFC below.)

- `HelpCenter` (per workspace): slug, `status` (`HelpCenterStatus` DRAFT|PUBLISHED), name, logoUrl, brandColor, theme, faviconUrl, heroTitle, heroSubtitle, navLinks JSON, footerLinks JSON, contactFormId, statusUrl, seo JSON, publishedAt.
- `HelpCollection`: helpCenterId, name, description, icon, slug, position, **`hidden Boolean @default(false)`** (refinement #2). `@@unique([helpCenterId, slug])`, `@@index([helpCenterId, position])`.
- `HelpArticle` = published-guide placement: collectionId, guideId, position, featured, titleOverride. `@@unique([collectionId, guideId])`, `@@index([collectionId, position])`.
- Back-relations: `Organization.helpCenter HelpCenter?`, `Guide.helpArticles HelpArticle[]` (powers "Published In").
- Migration `add_help_center` (enum + 3 tables + indexes; additive, no data change). Apply via `migrate dev --create-only` → review → `migrate deploy` → `prisma generate`.

---

## 3. Contracts (`packages/contracts/src/help-center.ts`, subpath export)

- `helpCenterStatusSchema`, `helpCenterSettingsSchema` (branding + hero + seo + nav/footer links + contactFormId + statusUrl), `createCollectionSchema` / `updateCollectionSchema` (name/description/icon/hidden), `reorderSchema` (`{ ids: string[] }`), `addArticlesSchema` (`{ guideIds: string[] }`), `collectionIconSchema` (curated lucide set).
- Public payload types: `PublicHelpCenter`, `PublicHelpCollection`, `HelpArticleCard` (title, excerpt, readMinutes, featured, slug), `HelpSearchHit`.
- Owner types: `HelpCenterDetail`, `HelpCollectionDetail`, `HelpArticleDetail`, `GuideHelpPlacement` (for "Published In").

---

## 4. API changes

**Owner** (`features/help-center/router.ts`, auth + workspace):
- `GET /api/help-center` — get-or-create (self-heal like `ensureDefaultFolder`); returns center + collections + article cards.
- `PATCH /api/help-center` — settings/branding.
- `POST /api/help-center/publish` — draft → published copy (mirrors form publish).
- `POST/PATCH/DELETE /api/help-center/collections[/:id]` + `POST …/collections/reorder` + `POST …/collections/:id/duplicate` + `PATCH …/collections/:id` (rename/hide).
- `POST /api/help-center/collections/:id/articles` (add published guides) · `DELETE …/articles/:articleId` · `POST …/articles/reorder` · `POST …/articles/:id/feature`.
- `GET /api/help-center/available-guides?q=` — published guides not yet in the target collection (the picker).
- `GET /api/guides/:id/help-placements` — reverse lookup for "Published In" (refinement #4).

**Public** (`features/public/help-router.ts`, no auth, by slug):
- `GET /api/public/help/:slug` — homepage payload (center brand + visible collections + featured cards).
- `GET /api/public/help/:slug/collections/:cslug` — collection + ordered article cards.
- `GET /api/public/help/:slug/articles/:aslug` — **reuses the guide public serialize** → the reader payload + help-center chrome context.
- `GET /api/public/help/:slug/search?q=` — full-text hits (Phase 5).
- Analytics beacon reuses `POST /api/public/guides/:shareId/events` for article reads; help-center-level events (Phase 6).

---

## 5. Public routes (`apps/web/app/help/[slug]/…`, SSR, no auth)

- `/(help)/[slug]/page.tsx` — homepage (hero + search, collection grid, popular/featured, still-need-help + status rail, footer).
- `/[slug]/[collection]/page.tsx` — collection (breadcrumb, sibling nav, ordered cards).
- `/[slug]/[collection]/[article]/page.tsx` — **the Guide Reader** (`PublicGuideView`) inside help-center chrome + related/next-prev + "Was this helpful?" + Contact.
- `/[slug]/search/page.tsx` — SEO/deep-link search results.
- Metadata (`generateMetadata`), `sitemap.ts`, `robots` per help center. Theme + language switch persist. Design lifted from the approved `/help-demo` prototype, re-skinned in Datum.

---

## 6. Owner routes (`apps/web/app/(app)/help-center/…`)

- Lives in the **double-sidebar shell** (Rail "Help center" item wired + a `HelpCenterPanel` as the second column: All articles + Collections + Design/Settings), content card swaps by selection. Design lifted from the approved `/help-demo/manage` prototype.
- **Content:** article **cards** (refinement #1) with drag reorder; the "Add published guides" command picker; collection `⋯` menu (rename/duplicate/hide/delete). **Design:** brand controls + live preview. **Settings:** slug/visibility/SEO/contact (+ Status URL as a deprioritized row). Publish in the editor navbar, dirty-gated.

---

## 7. Search architecture (Phase 5)

- **Postgres full-text**, no new infra. A `tsvector` computed over `guide.title` (weight A) + `summary` (B) + concatenated step content (C), scoped to the help center's published article set. Query via `to_tsquery`/`websearch_to_tsquery`, `ts_rank` ordering, **featured boost**. Snippet via `ts_headline` for highlight; client also highlights the matched term.
- Surfaces: `⌘K` command overlay (reuse `CommandPalette` grammar) + a full results page. `/` focuses the inline hero search (refinement #3).
- Start simple (title-weighted rank + featured boost); upgrade path noted, no ML.

---

## 8. SEO strategy (Phase 4)

- SSR pages, per-page `<title>`/meta/OG via `generateMetadata`; JSON-LD (`Article`, `FAQPage` when the guide has FAQs); per-help-center `sitemap.xml` + `robots`; canonical URLs; `noindex` for Unlisted. Fast LCP (hero + search are the only above-the-fold JS).

---

## 9. Analytics integration (Phase 6 — reuse Phase 12)

- Article reads already emit `GuideEvent`s; the public reader sets `context.referrerHost` — help-center reads carry a help-center marker so the **existing guide analytics "sources"** shows help-center traffic with **zero new plumbing**.
- Add help-center-level events (same beacon pattern): `hc_view`, `hc_search` (query → top/zero-result searches), `hc_collection_open`, `hc_contact_click`. A small Help Center analytics view (top articles, top searches, zero-result searches) reusing the analytics UI primitives (`StatCard`, `TrendChart`, `BarRow`). **No separate analytics system.**

---

## 10. Components (reuse first)

- **Reused:** `PublicGuideView` + all reader internals, `RailButton`/`Reticle`/`ViewRow`/`FolderIndicators`, `Button`/`Input`/`Switch`/`DropdownMenu`/`Dialog`/`Tooltip`, `CommandPalette` grammar, analytics `ui.tsx` + `TrendChart`, brand tokens, `useAnonId`/`guide-tracker`.
- **New (help-center only):** `HelpCenterPanel` (second sidebar column), `ArticleCard` (visual card), `CollectionRow` + `⋯` menu, `AddGuidesPicker`, `BrandDesignPanel` (thin wrapper over shared brand controls), public `HelpChrome` (header/footer/theme/lang), `HelpSearchOverlay`, `HelpHero`, `CollectionGrid`, `PublishedIn` (guide-editor section).

---

## 11. Testing strategy

- **Pure/unit (api):** publish copy (draft→published), slug generation + collision, article-card read-time derivation, search ranking (featured boost + weighting) over synthetic rows, "Published In" reverse lookup — hand-rolled `test()` + `node:assert/strict`, added to the api test script.
- **Contract:** settings/collection/reorder schemas reject bad input.
- **Per phase:** `turbo build typecheck lint` + api + db tests green.
- **Manual E2E:** create → brand → add published guides → reorder/feature → publish → public homepage/collection/article (full reader) → search (⌘K, `/`, highlight) → Contact form → guide edit shows "Published In" → unpublish a guide removes its article → light/dark + language → SEO/sitemap.

---

## 12. Rollout order (commit after each; each independently green) — ✅ all shipped

1. ✅ **Phase 1 — Database + Contracts + Migration.** schema (incl. `hidden`), migration, `help-center` contracts.
2. ✅ **Phase 2 — Owner APIs.** get-or-create, settings, collections (CRUD + reorder + duplicate + hide), articles (add/remove/reorder/feature), publish, available-guides, help-placements + tests.
3. ✅ **Phase 3 — Owner Builder.** double-sidebar builder: Content (article cards + picker + collection menu), Design (live preview), Settings; wire the Rail "Help center" item + "Published In" in the guide editor.
4. ✅ **Phase 4 — Public Help Center.** SSR homepage + collection + article (reader integration) + chrome + theme + SEO/sitemap.
5. ✅ **Phase 5 — Search.** Postgres FTS + endpoint + ⌘K overlay + results page + highlight + `/` shortcut.
6. ✅ **Phase 6 — Analytics.** help-center events (`HelpCenterEvent`) + search/zero-result/collection analytics + guide-read source attribution + analytics tab reusing the guide-analytics primitives.
7. ✅ **Phase 7 — Polish.** Flash-free light-only theme (pre-paint script + `useForceLight`), contrast-aware navbar foreground, search-overlay a11y, streaming loading skeleton, empty/404 states, `/help-demo` prototype removed, docs marked Shipped.

---

## 13. Files touched (indicative)

- **db:** `schema.prisma`, `prisma/migrations/*_add_help_center/`, `src/index.ts` (an `ensureHelpCenter` helper, mirroring `ensureDefaultFolder`).
- **contracts:** `src/help-center.ts` (+ `package.json` subpath).
- **api:** `features/help-center/{router,publish,serialize,search}.ts` + tests, `features/public/help-router.ts`, `features/guide/router.ts` (help-placements), `app.ts` (mounts).
- **web (owner):** `app/(app)/help-center/…`, `components/help-center/*`, `components/app-shell/help-center-panel.tsx`, Rail wiring, guide editor `PublishedIn`.
- **web (public):** `app/help/[slug]/…` (+ layout, loading, sitemap, metadata), `components/help/*`, `lib/help-tracker.tsx`.
- **cleanup:** ✅ the `/help-demo` design prototypes were removed once the real routes landed (Phase 7).
