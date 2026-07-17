# Phase 17 — Marketing Site, SEO, pSEO, AEO & ASO — RFC

**Status:** Proposed · **Author:** Principal Eng · **Date:** 2026-07-17
**Scope:** `apps/web` (marketing route groups + SEO infra), Chrome Web Store listing, off-page.
**Constraint:** Ship the P0 in **days** (launch), production-grade, highest ROI first. Product is done; this is everything *around* it.

> **Thesis.** Tacto's biggest SEO asset is the product itself. Every guide, showcase, and help center a user publishes is already server-rendered, is literal `HowTo` step content, and links back with "Made with Tacto." That is exactly the moat Scribe built (Fortune-500 reach off ~6M public guides) — a compounding, near-free UGC + backlink flywheel. We (1) turn that flywheel on properly, (2) wrap it in a fast marketing site, and (3) layer programmatic pages + schema so we win both classic search **and** AI answer engines. Everything below is ordered so a skeleton launch ships this week and the compounding engine runs behind it.

---

## 1. Competitive teardown (what the leaders actually do)

| Player | Positioning | pSEO plays | Content/SEO engine | Notable |
|---|---|---|---|---|
| **Scribe** (scribe.com) | "Documentation that writes itself" → workflow context for teams **and AI agents** | `/solutions/{function}` (it, ops, hr, finance), `/solutions/{use-case}` (onboard-new-hires, train-employees…), `/gallery` template hub, `/customers/{company}` | ~6M users → **public guides indexed at scale** = long-tail moat; segmented signup funnels `?useCase=` | "Trusted by 94% of Fortune 500"; leans into **AI-agent context** as the 2026 wedge |
| **Supademo** (supademo.com) | "AI-powered interactive demo platform, 150k+ businesses" | `/use-cases/*`, `/industries/*`, **16+ `/compare/{tool}-alternative`**, `/features/*` (11), `/content/*` strategy hubs | Blog with **tool how-to guides** (`/blog/guides` — HubSpot, Jira, Figma…), alternatives posts, G2-leader social proof | The **comparison/alternative** machine is their standout; "interactive vs passive video" wedge |
| **Guidejar** (guidejar.com) | "Turn every 'how do I do this?' into a guide" | `/solutions/*`, `/features/*` | Interactive demo **embedded on the landing page**; testimonial subdomain; **`/mcp` (ChatGPT integration)** | Weaker on blog/pSEO; strong on **live product-on-landing** and an **AEO/MCP distribution** move |

**What we steal:** Supademo's comparison + use-case + industry pSEO; Scribe's public-UGC flywheel + solution/function pages + template gallery; Guidejar's live-demo-on-landing + MCP/AEO. **What we do better:** our public guides are *already* SSR HowTo content — we index them from day one with schema, which none of them started with early.

---

## 2. Where it all lives (architecture)

- **One app.** Marketing lives in `apps/web` under a `(marketing)` route group. Root `/` becomes the landing (today it's a redirect stub — "Becomes the marketing page at launch"). Rationale: shared design system, we can embed the **real product** on the landing (dogfood), one deploy, and the UGC pages already live here.
- **Rendering:** marketing + pSEO = **SSG/ISR** (fast, cacheable, cheap). Public UGC (`/g`, `/showcase`, `/help`) already SSR — keep, add schema + sitemap. Set `metadataBase` from `NEXT_PUBLIC_SITE_URL`.
- **Content:** MDX in-repo for blog + editorial (`content/blog/*.mdx`), typed **data files** for pSEO (`content/compare/*.ts`, `content/use-cases/*.ts`) driving `generateStaticParams`. No CMS dependency for launch (add Sanity/Notion-as-CMS later only if a non-eng writer needs it). Loader: `next-mdx-remote/rsc` + `gray-matter` (RSC-native, no heavy build step).
- **OG images:** dynamic via `next/og` `ImageResponse` (`opengraph-image.tsx` per route + a template for guides/showcases).
- **Schema:** one `lib/seo/schema.ts` helper emitting JSON-LD `<script type="application/ld+json">`.
- **No new infra** required for P0. (pSEO scale in P2 may add a content pipeline; flagged there.)

---

## 3. Workstreams

### WS-1 · Technical SEO foundation (the non-negotiable base) — **P0**
Nothing ranks without this; it's small and mechanical.
- `app/robots.ts` — allow all; **explicitly allow AI crawlers** (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, CCBot) — we *want* to be cited; disallow `/api`, `/embed`, app-internal (`/home`, `/settings`, editors), `/datum`, `/shellpreview`; point to sitemap.
- `app/sitemap.ts` — dynamic: static marketing routes + pSEO routes + **published & listed** guides (`/g/{shareId}`), showcases (`/showcase/{slug}`), help centers (`/help/{slug}` + collections + articles), blog posts. Chunk if >50k URLs (sitemap index) — relevant once UGC scales.
- `app/manifest.ts` + favicons/app icons + theme-color.
- `metadataBase` + per-route `generateMetadata` (title, description, canonical, `openGraph`, `twitter:card=summary_large_image`, `robots` index/noindex).
- **Canonicalization**: self-referencing canonicals; guides/showcases canonical to their public URL (not the embed).
- Keep the existing gate: UGC stays `noindex` until **published + listed** (already implemented) — now those that *are* public go into the sitemap.
- **Effort:** ~1 day. **This is launch-blocking.**

### WS-2 · Landing page + core marketing pages — **P0**
The conversion surface. Lead with the product, not a stock hero.
- `/` landing: hero with a **live embedded Tacto guide/showcase** (dogfood — Guidejar's best move) + one-line value prop + primary CTA ("Create your first guide — free"); logo/социal-proof strip; **Record → Customize → Share** 3-step; feature grid; use-case tiles; embed-everywhere logos; short pricing teaser; **FAQ (with `FAQPage` schema)**; final CTA. Design to Datum; one bold hero moment, restraint elsewhere (see the design POV already on file).
- `/pricing` — tiers + `SoftwareApplication`/`Offer` schema + FAQ. (Benchmarks: Supademo Free/$50/$450/Enterprise; Guidejar free=5 guides. Land a **free tier that keeps "Made with Tacto"** — that's the flywheel fuel.)
- `/features` + `/features/{slug}` — one page per headline capability (AI guides, interactive walkthrough, PDF/MP4 export, showcases, help center, forms, embeds, analytics, translations). Each: problem → how Tacto does it → live demo → CTA.
- `/use-cases/{slug}` — SOPs, employee onboarding, customer onboarding, IT/helpdesk, customer support, product marketing, sales demos, training. (Supademo/Scribe both monetize these.)
- **Effort:** landing ~2 days; template + first 4–6 sub-pages ~2 days (the rest are data-driven, cheap after the template).

### WS-3 · The UGC SEO + backlink flywheel (our unfair advantage) — **P0/P1**
This is the highest-ROI item and mostly already built.
- **HowTo schema on every public guide** (`/g/{shareId}`) — steps → `HowTo` + `HowToStep` with images; guides literally are this. Directly wins AI answer engines + rich results. **P0.**
- **FAQPage schema** on help articles + guide FAQs (the FAQ feature already stores these). **P0.**
- **"Made with Tacto" = the backlink engine.** Verify the badge on every public guide/showcase/help/embed links to the site with a real anchor; free tier cannot remove it. Every published artifact = a backlink + brand impression. **P0** (audit + strengthen).
- **Public gallery/index** `/guides` (or `/gallery`) — an indexable hub linking published+listed guides/showcases by category/tool, mirroring Scribe's `/gallery`. Turns scattered UGC into a crawlable, internally-linked cluster. **P1.**
- Ensure OG images render for shared guides/showcases (social CTR). **P1.**
- **Effort:** schema + badge audit ~1 day (P0); gallery ~1–2 days (P1).

### WS-4 · Programmatic SEO — **P1 → P2**
High commercial intent, template-once/scale-many.
- **Comparison / alternative pages** (Supademo's engine): `/compare/{competitor}` and `/{competitor}-alternative` for Scribe, Guidejar, Supademo, Tango, Arcade, Loom (for guides), Iorad, Storylane, Trainn, Folge. Each: honest comparison table, "why teams switch," migration, CTA. Data-driven from `content/compare/*.ts`. **P1** (start with the 4–6 highest-volume).
- **"How to {task} in {tool}"** guides — the scalable moat: publish real Tacto guides for popular tools (create a Jira ticket, build a HubSpot workflow, share a Figma file…) at `/how-to/{slug}`, each an *actual embedded Tacto guide* → dogfoods the product, is native HowTo content, and demonstrates value inline. Supademo does exactly this. **P2** (needs a light content-production loop — record + publish).
- **Solution/function** pages (`/solutions/{it,ops,hr,support,marketing}`) — Scribe-style. **P2.**
- **Industry** pages — only if data supports demand. **P2.**
- **Effort:** comparison template ~1.5 days then ~0.5 day/page of copy; how-to library is ongoing content ops.

### WS-5 · Blog / editorial engine — **P1**
- MDX pipeline (`content/blog/*.mdx` → `/blog`, `/blog/{slug}`, `/blog/tag/{tag}`), `Article` + `BreadcrumbList` schema, author, `datePublished`/`dateModified` (freshness matters for AEO — 83% of AI citations are <12mo old), reading time, related posts, CTA blocks.
- **Launch set (5–10 posts)** targeting mid-tail + AEO intent: "best {competitor} alternatives," "how to create an SOP," "interactive demo vs screen recording," "how to write step-by-step documentation with AI," a data/opinion piece for links. Lead each with the direct answer in the first 100–200 words (AEO).
- **Effort:** engine ~1.5 days; posts ongoing (2–3 for launch).

### WS-6 · Answer Engine Optimization (AEO) — **P0 schema / P1–P2 rest**
Buyers now ask ChatGPT/Perplexity/AI Overviews for shortlists *before* visiting vendors — we must be extractable and cited.
- **Schema everywhere** (P0): `Organization` + `WebSite`(+`SearchAction`) + `SoftwareApplication`(features, offers, aggregateRating) sitewide; `HowTo`, `FAQPage`, `Article`, `BreadcrumbList` per page type. Schema must mirror visible content.
- **Answer-first content** (P1): FAQ blocks, comparison tables, concise definitions up top, clear H2/H3 + lists.
- **`/llms.txt` + `/llms-full.txt`** (P1): the emerging convention that gives AI crawlers a clean product/feature/pricing summary + key links.
- **Do NOT block AI crawlers** (covered in WS-1) — being cited > protecting content here.
- **Public MCP server** (P2, Guidejar parity): let ChatGPT/Claude surface and search Tacto guides — distribution + citation. We already have an SDK/embed mental model; an MCP is a natural extension.
- **Effort:** schema folds into WS-1/2/3; llms.txt ~0.25 day; MCP ~2–3 days (P2).

### WS-7 · App Store Optimization (Chrome Web Store) — **P1**
The extension is a top acquisition channel; the store is its own search engine.
- **Title** (heaviest ranking factor, ~35 chars shown): `Tacto — Screen Recorder & Guide Maker` style; front-load **problem keywords** users actually type ("how-to guide maker," "SOP creator," "screenshot tutorial," "screen capture documentation") — mine Chrome store autocomplete.
- **Description**: first **150–200 words** keyword-rich + value (that's what the algorithm reads); rest = use cases, audiences, features.
- **Assets**: 5 high-res **annotated** screenshots (bold overlays on the hero feature) + a promo tile/video; tell the value in 3 seconds → lifts Add-to-Chrome CTR, itself a ranking signal.
- **Trust**: link the extension to the **verified `tacto.com` domain** (ranking boost); Manifest V3 + no perf regressions (penalized otherwise); privacy policy page.
- **Loop**: drive installs from the landing (CTR signal); ask happy users for reviews.
- **Effort:** ~1 day (copy + assets); depends on design for screenshots.

### WS-8 · Off-page / backlinks / launch distribution — **P1, then ongoing**
- **Launch blast**: Product Hunt (with a live embedded demo), BetaList, Hacker News (Show HN), relevant subreddits/Slacks/Discords.
- **Directories** (fast DA + comparison traffic): G2, Capterra, GetApp, **AlternativeTo**, SaaSHub, Product Hunt, Chrome Web Store, Slant. Claim + seed reviews.
- **The flywheel again**: "Made with Tacto" on every free-tier public artifact is the compounding backlink source — nothing else scales like it.
- **Integrations/partners** pages ("Embed Tacto in Notion/Confluence/Framer…") — co-marketing + long-tail.
- **Digital PR / linkable asset**: one data report ("State of how-to documentation 2026") à la Supademo's `/content/state-of-interactive-demos`.
- **Effort:** launch prep ~1–2 days; ongoing.

---

## 4. Launch plan (ruthless prioritization)

**P0 — ship for launch day (must-have, ~4–6 focused days):**
1. WS-1 technical foundation (robots, sitemap, metadata, manifest, canonical, OG template).
2. WS-2 landing `/` + `/pricing` + `/features` shell.
3. WS-3 HowTo/FAQ schema on public guides/help + "Made with Tacto" backlink audit.
4. WS-6 core schema (Organization/WebSite/SoftwareApplication) + AI crawlers allowed.
5. Sitemap submitted to Google Search Console + Bing Webmaster; analytics live (Plausible/PostHog).

**P1 — week 1–2 (compounding starts):**
- WS-2 use-case/feature sub-pages · WS-4 top 4–6 comparison pages · WS-5 blog engine + 3 posts · WS-3 public gallery · WS-6 llms.txt · WS-7 Chrome Web Store optimization · WS-8 launch distribution + directories.

**P2 — ongoing moat:**
- "How-to in {tool}" guide library (dogfooded pSEO) · solution/industry pages · MCP server · case studies · digital-PR asset · continual comparison/blog expansion.

---

## 5. Tech choices (locked recommendations)
- **Marketing in `apps/web`**, `(marketing)` route group; `/` = landing.
- **SSG/ISR** for marketing + pSEO; keep SSR for UGC.
- **MDX**: `next-mdx-remote/rsc` + `gray-matter`; typed data files for pSEO. (Revisit a CMS only when non-eng writers need it.)
- **OG**: `next/og` `ImageResponse`.
- **Schema**: `lib/seo/schema.ts` JSON-LD helpers.
- **Analytics**: Plausible or PostHog (privacy-friendly, fast) + GSC + Bing.
- **Env**: `NEXT_PUBLIC_SITE_URL` → `metadataBase`; confirm production domain (assumed `tacto.com` — **needs confirmation**).

---

## 6. Measurement
- Search Console (impressions, clicks, indexed pages, rich-result validity), Bing Webmaster.
- Rank tracking for head + comparison + use-case terms.
- **AI-citation monitoring** (are we cited by ChatGPT/Perplexity/AI Overviews for shortlist/comparison queries).
- Chrome Web Store analytics (impressions → installs).
- Product analytics: signup source attribution; "Made with Tacto" click-throughs; published-artifact count (flywheel volume).

---

## 7. Risks & mitigations
- **Thin pSEO pages** → Google punishes low-value doorway pages. Mitigation: every programmatic page carries genuine value (real comparison data, a real embedded guide), not spun copy.
- **UGC quality/abuse** → indexing user content risks spam/thin pages. Mitigation: only **published + listed** artifacts (existing gate); add basic quality/length thresholds before a page enters the sitemap; nofollow untrusted outbound.
- **Marketing/app coupling** → keep a clean `(marketing)` boundary; no app auth in marketing routes.
- **Domain/brand not finalized** → blocks canonical/OG/verified-domain ASO. **Confirm the production domain before P0.**
- **Freshness decay** → AEO rewards recency; schedule content refreshes (`dateModified`).

---

## 8. Open questions (need your call)
1. **Production domain** (canonical everything): `tacto.com`? other?
2. **Free tier** shape — confirm it keeps a non-removable "Made with Tacto" (the flywheel depends on it) and the guide/showcase limits.
3. **Pricing** numbers for `/pricing` + `Offer` schema.
4. **Blog authoring** — eng-owned MDX for launch, or do you want a CMS from day one?
5. **Public gallery** — opt-in per artifact, or auto-list all published+listed? (Privacy vs SEO tradeoff.)
6. Analytics preference: **Plausible vs PostHog** (PostHog also gives product analytics/session replay).

---

*If approved, I'll split this into P0/P1 implementation plans (like the phase-15/16 plans) and start with WS-1 + WS-2 landing so a real marketing site + full SEO foundation is live before launch day.*
