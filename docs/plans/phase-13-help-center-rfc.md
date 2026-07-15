# Phase 13 — Help Center — RFC

**Status:** Proposed · **Author:** Principal Eng · **Date:** 2026-07-15
**Scope:** `apps/web`, `apps/api`, `packages/{contracts,db,ui}` · builds on Guides, the public reader, Folders, Forms, and Guide Analytics

---

## 1. Summary

A **Help Center**: a branded, searchable, public knowledge base where a workspace collects its **published guides** into organized collections, hosted at its own URL, for its end-users to self-serve. This is the natural aggregation layer above single-guide share links — the same move Guidejar makes.

The key idea — and the reason this is cheap to build well — is that a help-center **article _is_ a published guide**. Nothing is re-authored. The Help Center adds only three things on top of what Tacto already has:

1. **Structure** — collections (categories) that group guides.
2. **A destination** — a branded homepage + navigation at a stable URL (`/help/{slug}`, custom domain later).
3. **Findability** — full-text search across the workspace's guides.

Everything else is reuse: the **guide reader** renders articles, **workspace/guide branding** styles the site, **Forms** power "Contact / Submit a request", and the **GuideEvent** analytics log already captures per-article reads (we add help-center-level view/search events).

### The two flows (the product in one breath)

- **Owner (your user):** open Help Center → brand it → create collections → drop in **already-published guides** → arrange/feature → publish → share one link. Edit a guide later and the help center updates itself (it points at the published version).
- **Visitor (their end-user, never logs in):** land on the branded homepage → **search** or **browse a collection** → open an article → read it in the **familiar guide reader** → if still stuck, **Contact / Submit a request** (a Tacto form) → leave with the answer.

### Guiding principles
Reuse existing infrastructure · No duplicate systems · An article is a published guide (never a copy) · No breaking changes · Type-safe end-to-end · Every phase compiles/ships · Public surface is fast, accessible, SEO-clean, and works logged-out.

### Non-goals (v1 — deferred)
- **Custom domains + SSL** (v1 ships `tacto.so/help/{slug}`; domain mapping is Phase-later).
- **AI answers / chat widget** over the corpus (search is keyword v1).
- **Non-guide article types** (rich-text-only articles, changelogs, API reference embeds) — v1 articles are guides only.
- **Multiple help centers per workspace** (v1 = one per workspace; the model allows more later).
- **Granular reader auth / gated/private articles** (v1 = public or unlisted whole-site).
- **Automated translations of the shell** (guide content already translates; the shell ships owner-provided locale strings later).
- **A launcher widget / in-app embed** of the help center (own the destination first; widget is a fast follow).

---

## 2. Data model (`packages/db/prisma/schema.prisma`)

Additive. An article is a **relation**, not content — deleting it never touches the guide.

```prisma
model HelpCenter {
  id             String   @id @default(uuid())
  organizationId String   @unique              // one per workspace (v1)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  slug           String   @unique               // tacto.so/help/{slug}
  status         HelpCenterStatus @default(DRAFT) // DRAFT | PUBLISHED
  // Branding (mirrors guide customization brand block; defaults inherit workspace)
  name           String                          // "Acme Help Center"
  logoUrl        String?
  brandColor     String?                         // hex; defaults to cobalt
  theme          String   @default("system")     // light | dark | system
  faviconUrl     String?
  // Homepage
  heroTitle      String   @default("How can we help you?")
  heroSubtitle   String?
  // Chrome: nav + footer links, contact form, status URL — small JSON blobs
  navLinks       Json?    // [{ label, href, external }]
  footerLinks    Json?
  contactFormId  String?                         // a published Tacto form (Submit a request)
  statusUrl      String?
  seo            Json?    // { title, description, ogImage }
  publishedAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  collections    HelpCollection[]
  @@map("help_center")
}

model HelpCollection {
  id           String  @id @default(uuid())
  helpCenterId String
  helpCenter   HelpCenter @relation(fields: [helpCenterId], references: [id], onDelete: Cascade)
  name         String
  description  String?
  icon         String?                            // lucide icon name (curated set)
  slug         String
  position     Int     @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  articles     HelpArticle[]
  @@unique([helpCenterId, slug])
  @@index([helpCenterId, position])
  @@map("help_collection")
}

/// An article = a published guide placed in a collection. Content is the guide;
/// only ordering + optional display overrides live here.
model HelpArticle {
  id            String  @id @default(uuid())
  collectionId  String
  collection    HelpCollection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  guideId       String
  guide         Guide   @relation(fields: [guideId], references: [id], onDelete: Cascade)
  position      Int     @default(0)
  featured      Boolean @default(false)           // surfaces on the homepage
  titleOverride String?                           // optional shelf label; falls back to guide.title
  createdAt     DateTime @default(now())

  @@unique([collectionId, guideId])               // a guide appears once per collection
  @@index([collectionId, position])
  @@map("help_article")
}
```

- `Guide` gains `helpArticles HelpArticle[]`, `Organization` gains `helpCenter HelpCenter?`.
- A guide may appear in **multiple collections** (unique is per-collection). Deleting/unpublishing a guide removes/hides the article (public serialize filters to `PUBLISHED, deletedAt: null`).
- **Search:** v1 uses Postgres full-text (a generated `tsvector` over `guide.title + summary + step content` scoped to the help center's article set) — no new search infra; upgradeable to a dedicated index later.

---

## 3. Owner experience — the builder (`/(app)/help-center`)

A focused, single-destination manager with three tabs, a persistent **live preview** affordance, and a **Publish** action in the editor navbar (reusing `useSetNavbar` + the `EditorChrome` pattern from the guide/form editors). Autosaves like the editors (draft → publish), so "Publish" pushes the site live.

### 3.1 Content tab (the spine)
- **Left:** the collection list — a vertical, **drag-reorderable** stack (up/down handles + drag, matching the guide sort). Each row: icon, name, article count, a `⋯` menu (rename / edit / delete / add articles). A dashed **"+ New collection"** row at the bottom.
- **Center:** the selected collection's **articles** — drag-reorderable rows (doc icon, guide title, status dot, read-time estimate, a **★ feature** toggle, remove). Empty state: "No articles yet — add published guides."
- **Add articles** → a **command-style picker** (⌘-K feel): searches the workspace's **published** guides, multi-select with checkboxes, shows "Already in this collection" as disabled, "Add N articles" primary. This is the one moment that ties the help center to the guide library.
- **Featured** articles (★) bubble up to the homepage's "Popular articles" shelf.

### 3.2 Design tab (branding, live-previewed)
- Logo upload, **brand color** picker, **theme** (light/dark/system), favicon, hero **title/subtitle**. Mirrors the guide **Customize** panel's control style.
- A **live preview** pane (right, or a full-screen "Preview" button opening the public view against the draft) updates **as you type** — same instant-feedback loop as guide customization. Microinteraction: color changes ripple through the preview's accents with a 150ms transition.

### 3.3 Settings tab
- **Slug** (with availability check + copyable public URL), **visibility** (Public / Unlisted), **SEO** (title/description/OG image), **nav links** + **footer links** (add/edit/reorder small rows), **Contact** (pick a published form for "Submit a request"), **Status URL**.
- **Custom domain** row shown as "Coming soon" (v1), so the information architecture is already there.

### 3.4 Builder microinteractions
- Drag-reorder: spring-eased row lift (matches the card hover spring already in the app), a drop shadow that deepens while dragging, siblings sliding to make room.
- Add-article picker: results filter on keystroke; `↑/↓` to move, `Enter` to toggle, checkmark scales in; a subtle count in the primary button (`Add 3`).
- Feature toggle: the ★ fills with a spring + a tiny scale pop.
- Save state: the editor navbar shows "Saving… / Saved" + an "N changes" counter (identical to the guide/form editors), and **Publish** is disabled until there are unpublished changes (same dirty logic just built for forms).
- Publish success: toast "Help center published", and the navbar's **View** button (opens the live URL) gets a one-time pulse.

---

## 4. Visitor experience — the public help center

Logged-out, fast, SEO-clean. Three surfaces + search, all rendered server-side for crawlability, hydrated for interactions. Re-skins the reference screenshot into the Datum system.

### 4.1 Homepage (`/help/{slug}`)
- **Header:** logo + "Help Center", owner nav links, a **Contact Support** button; theme toggle + language selector on the right.
- **Hero:** big editorial `How can we help you?` (uses the reader's `font-serif` heading treatment), a one-line subtitle, and the **search bar** front-and-center with a `⌘K` chip.
- **Collection grid:** cards (icon in a tinted chip, name, description, `N articles`, a chevron). Hover: the card lifts on a spring, the icon chip brightens, the chevron slides right — the same language as `GuideCard`.
- **Popular articles:** the featured set as a clean list (doc icon, title, one-line excerpt, read-time, chevron), with a **"View all articles"** button.
- **Still need help? / System status** rail (right): Contact Support + Submit a request (→ the chosen form, opened inline), and a status pill ("All systems operational" + link).
- **Footer:** brand, copyright, Privacy/Terms/Cookies (owner links), theme + language.

### 4.2 Collection page (`/help/{slug}/{collection}`)
- Breadcrumb (`Help Center / {Collection}`), collection title + description, then the **ordered article list**. Same row treatment as popular articles. A left mini-nav of sibling collections (sticky) for lateral movement.

### 4.3 Article page (`/help/{slug}/{collection}/{article}`)
- **This is the guide reader**, rendered inside the help-center chrome (header + breadcrumb + a right "On this page / Related articles" rail). The reader is unchanged — scroll or walkthrough, screenshots + pointer, language switch, PDF, reactions/comments — so an article inherits every guide feature for free.
- **Related articles** (same collection, next/prev) at the bottom; a "Was this helpful?" prompt (reuses guide feedback), and a "Still stuck? Contact support" CTA.

### 4.4 Search (the centerpiece)
- **⌘K / click** opens a search overlay (command-palette styling, reusing the app's `CommandPalette` visual grammar). Instant results as you type: grouped by collection, each hit showing title + matched snippet with the query **highlighted**; `↑/↓/Enter` navigation; recent/empty state ("Popular searches").
- A full **search results page** (`/help/{slug}/search?q=`) for deep links and SEO, listing ranked hits with excerpts.
- Microinteraction: the overlay scrims + scales in (respecting `prefers-reduced-motion`); results cross-fade between keystrokes; a keyboard hint row anchors the footer.

### 4.5 Visitor microinteractions & polish
- Category/article hover springs, chevron nudges, focus-visible rings on every interactive element (keyboard-first).
- The header condenses on scroll (search collapses into a compact pill in the header once the hero scrolls away — a Stripe/Linear touch).
- Theme + language switch persist (localStorage), animate the swap with a short cross-fade.
- Skeletons for search results; graceful empty states everywhere ("No results for '…' — try different keywords, or Contact support").
- 404 for unknown collection/article → branded "Article not found" with search + home CTA.

---

## 5. Theming, accessibility, i18n, SEO

- **Theming:** the site renders in the owner's brand color + chosen theme. Light/dark both first-class (tokenized like the app). Brand color drives `--primary`; everything else is Datum neutrals so contrast stays AA.
- **Accessibility:** semantic landmarks (`header/nav/main/footer`), skip-link, visible focus, full keyboard search, `aria-current` breadcrumbs, `prefers-reduced-motion` honored.
- **i18n:** guide **content** already translates (the reader's language switcher works per article); the **shell** strings ship English v1 with an owner-locale hook reserved.
- **SEO:** SSR pages, per-page `<title>`/meta/OG, JSON-LD (`Article` + `FAQPage` where FAQs exist), a generated `sitemap.xml` + `robots.txt` for the help center, canonical URLs, and fast LCP (the hero + search are the only above-the-fold JS).

---

## 6. Analytics (reuse + extend)

The Help Center is a distribution channel for guides, so it plugs into the analytics just shipped:
- Article reads already emit `GuideEvent`s (view/complete/etc.) — attribute them to the help center via `context.referrerHost = help-center` (already captured), so per-guide analytics "sources" shows help-center traffic **for free**.
- Add lightweight **help-center-level** events (reusing the beacon pattern): `hc_view` (homepage), `hc_search` (with the query, for a "top searches / no-result searches" report), `hc_collection_open`, `hc_contact_click`. Surfaced later in a Help Center analytics tab (top articles, top searches, zero-result searches — the highest-signal KB metrics).

---

## 7. Reuse map (what we do NOT rebuild)

| Need | Reused from |
|---|---|
| Article content + rendering | Published `Guide` + the public reader (`PublicGuideView`, `interactive-view`, PDF, translations, reactions) |
| Branding controls + live preview | Guide **Customize** panel patterns + brand tokens |
| Draft → publish, autosave, dirty/Update gating | The guide/form editor machinery (`useSetNavbar`, `EditorChrome`, history/autosave) |
| "Submit a request" | A published **Form** (embedded inline, like guide form-overlays) |
| Search overlay styling | The app `CommandPalette` grammar |
| Per-article analytics | The **GuideEvent** log (Phase 12) |
| Card/list/hover language | `GuideCard` / Datum tokens |

Net-new is small: `HelpCenter/HelpCollection/HelpArticle`, the public SSR routes, the search index/endpoint, and the builder shell.

---

## 8. API surface (indicative)

**Owner (auth + workspace):** `GET/PUT /api/help-center` (get-or-create + settings/branding), `POST/PATCH/DELETE /api/help-center/collections[/:id]` (+ `/reorder`), `POST/DELETE /api/help-center/collections/:id/articles` (add published guides / remove) + `/reorder` + `/feature`, `POST /api/help-center/publish`, `GET /api/help-center/available-guides?q=` (the picker).
**Public (no auth, by slug):** `GET /api/public/help/:slug` (homepage payload), `/:slug/collections/:cslug`, `/:slug/articles/:aslug` (→ reuses the guide public serialize), `GET /api/public/help/:slug/search?q=`, plus the analytics beacon.

---

## 9. Phasing (each ships independently)

1. **Model + owner CRUD** — schema/migration, contracts, help-center get-or-create + collections + articles (add/reorder/feature) API. No UI.
2. **Builder** — Content/Design/Settings tabs, the add-guide picker, drag-reorder, live preview, publish. Owner can assemble + publish (URL works).
3. **Public site** — SSR homepage + collection + article (reader) + branded chrome + theme/lang, SEO/sitemap.
4. **Search** — full-text index + endpoint, the ⌘K overlay + results page.
5. **Polish + analytics** — help-center events + a small analytics tab, empty/404 states, performance pass, docs. (Custom domain + widget = future.)

---

## 10. Verification (per phase)

Owner can create a help center, brand it, add published guides into collections, reorder, feature, and publish → the public URL renders the branded homepage; a visitor can search (⌘K, highlighted snippets, keyboard nav), browse a collection, open an article (full reader), and hit Contact (a form); edits to a guide re-publish into the help center automatically; unpublishing a guide removes its article; light/dark + language both work; SSR + sitemap validate; `turbo build typecheck lint` + api/db tests green each phase; the guide analytics "sources" reflects help-center traffic.

---

## 11. Open questions

1. **One vs many help centers per workspace** — v1 assumes one (`@@unique organizationId`). Multi-center (e.g., per product) later needs dropping that constraint + a center switcher. *Proposed: one for v1.*
2. **Search ranking** — plain `tsvector` rank v1; do we weight title > steps, and boost featured? *Proposed: title-weighted + featured boost, no ML.*
3. **Contact = form vs email** — v1 uses a published Tacto form inline. Also offer a mailto/URL fallback? *Proposed: form primary, optional URL fallback.*
4. **Unlisted vs Public** — unlisted = no sitemap/robots + `noindex`; Public = indexed. *Proposed: both, Public default.*
5. **Article slugs** — from guide title (stable, human) vs guide id. Collisions handled by suffix. *Proposed: slugified title + `-n` on collision, redirect old→new on rename.*
