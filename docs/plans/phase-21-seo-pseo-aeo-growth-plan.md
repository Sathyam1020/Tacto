# Phase 21 — SEO / pSEO / AEO Growth Plan

> Execution plan built on the foundation from `phase-17-marketing-seo-rfc.md`.
> Anchored in **real keyword data** (OpenSEO / DataForSEO, US market, pulled 2026-07-19).
> Site launched hours ago → GSC is empty; strategy leans on keyword tools + competitor data until GSC fills in (2–4 weeks).

---

## 0. TL;DR — the strategy in five sentences

1. Our market is **emerging, not high-volume**: nobody searches "interactive product demo" at scale (50/mo). The winnable volume is in **SOP / process-documentation / how-to guides** and **competitor "alternatives"** terms.
2. **pSEO** is our biggest lever and the infra already exists — `compare/`, `use-cases/`, `tools/`, `blog/` are all data-driven arrays; a new page = a new typed entry.
3. **Comparison pages** (`[competitor] alternatives`, KD ≈ 0, commercial intent) are the fastest wins — add the missing ones.
4. **How-to content** (`how to create an SOP`, `how to create a user guide`, KD 0–10) is perfect-intent, low-difficulty, and doubles as **AEO** (quotable, structured, FAQ/HowTo schema).
5. **`knowledge base software` (301k/mo, KD32)** is the long-term anchor — a use-case page we build now and grow into.

---

## 1. Current state (done / exists)

**Technical foundations (Phase 17 + Step 2 this cycle):**
- ✅ Correct SSR (public) / CSR (app) split; dynamic DB-backed sitemap; robots.txt with AI-bot allow-list (GPTBot, PerplexityBot, ClaudeBot, Google-Extended…).
- ✅ Rich JSON-LD: HowTo + FAQPage on guides; Organization/WebSite/SoftwareApplication on landing; Product/Offer on pricing; BlogPosting on blog.
- ✅ Root metadata template + `pageMeta()` helper; marketing OG image generation.
- ✅ **Step 2 (branch `seo/technical-foundations-batch-a`):** de-hardcoded domain → `NEXT_PUBLIC_SITE_URL`; canonical on `/showcase`; `noindex,follow` on standalone `/f` forms; host-aware canonicals on all `/help/**` levels (`lib/canonical.ts`).

**pSEO content that exists today:**
| Collection | File | Entries |
|---|---|---|
| Comparisons | `lib/marketing/compare.ts` | scribe, guidejar, supademo, tango, arcade |
| Use-cases | `lib/marketing/use-cases.ts` | onboarding, support, sops, product-marketing, it, training |
| Free tools | `lib/marketing/tools.ts` | screenshot-annotator, screen-recorder, gif-maker, qr-code-generator, sop-creator, step-by-step-guide-maker |
| Blog | `lib/marketing/blog.tsx` | turn-any-workflow-into-a-guide, scribe-alternatives, sop-library-with-ai, interactive-demos-that-convert, reduce-time-to-value-saas |

---

## 2. Positioning (locked)

**Tacto** creates **interactive, step-by-step product guides and walkthroughs** captured via a Chrome extension — publish as shareable guides, embed as in-app overlays, roll into a branded help center on your own domain, collect input via forms, measure with completion analytics.

- **Primary users:** SaaS/product teams (onboarding, customer education, support deflection); founders/PMs documenting processes.
- **Jobs to rank for:** *make a how-to guide fast* · *build a self-serve help center / knowledge base* · *document SOPs* · *embed interactive walkthroughs*.
- **Competitor clusters:** capture/how-to (Scribe, Guidde, Tango, Supademo) and interactive-demo (Arcade, Storylane, Navattic, Walnut). We straddle both; **lead with capture/how-to**.

---

## 3. Keyword → page map (real data)

KD = keyword difficulty (0–100). Vol = US monthly searches. Intent from DataForSEO.

### Bucket A — Comparison / alternatives → `compare/[slug]` + blog (pSEO, fastest wins)
| Keyword | Vol | KD | Intent | Status |
|---|---|---|---|---|
| scribe alternatives | 480 | 0 | commercial | ✅ compare/scribe + blog/scribe-alternatives |
| tango alternatives | 140 | 0 | info | ✅ compare/tango |
| tango vs scribe | 170 | 0 | info | ⬜ new (competitor-vs-competitor angle) |
| walnut alternatives | 90 | 0 | info | ⬜ **new → compare/walnut** |
| guidde alternatives | 50 | 0 | info | ⬜ **new → compare/guidde** |
| scribehow alternatives | 50 | 0 | info | ✅ (maps to compare/scribe) |
| storylane alternatives | 40 | 0 | info | ⬜ **new → compare/storylane** |
| scribe vs guidde | 40 | 0 | info | ⬜ new |
| supademo alternatives | 30 | 0 | info | ✅ compare/supademo |
| arcade alternatives | 20 | 0 | info | ✅ compare/arcade |
| navattic alternatives | 10 | 0 | info | ⬜ **new → compare/navattic** |

### Bucket B — How-to / JTBD → `blog/[slug]` (low KD, perfect intent, AEO)
| Keyword | Vol | KD | Intent | Status |
|---|---|---|---|---|
| how to create an sop | 390 | 8 | info | ⬜ new post (sop-library-with-ai is adjacent) |
| step by step guide template | 170 | 10 | info | ⬜ **new post + link to tools/step-by-step-guide-maker** |
| how to create a user guide | 110 | 0 | info | ⬜ **new post** |
| how to create step by step instructions with screenshots | 70 | 0 | info | ~ turn-any-workflow-into-a-guide (optimize/target) |
| how to document a process | 50 | 5 | info | ⬜ **new post** |
| how to write a user manual | 30 | 0 | info | ⬜ new post |
| ai step by step guide creator | 30 | 12 | commercial | ~ tools page |

### Bucket C — Category / money terms → `use-cases/[slug]`, `solutions`, `features`, landing (on-page)
| Keyword | Vol | KD | Intent | Status |
|---|---|---|---|---|
| knowledge base software | 301,000 | 32 | commercial | ⬜ **new use-case: knowledge-base** (long-term anchor) |
| sop software | 1,000 | 0 | info | ✅ use-cases/sops (ensure targeted) |
| standard operating procedure software | 1,000 | 0 | info | ✅ use-cases/sops |
| documentation tool | 480 | 19 | info | ⬜ use-case/solution |
| process documentation software | 320 | 0 | commercial | ⬜ **new use-case: process-documentation** |
| user onboarding software | 110 | 9 | commercial | ⬜ **new use-case: user-onboarding** |
| interactive demo software | 110 | 26 | info | ~ features/solutions |
| software documentation tool | 110 | 0 | info | ⬜ use-case/solution |
| help center software | 140 | 34 | navigational | ~ help-center feature page |
| product tour software | 70 | 0 | commercial | ⬜ solution/use-case |
| product walkthrough software | 20 | 0 | info | ⬜ solution |
| interactive walkthrough software | 30 | 4 | info | ⬜ solution |

### Bucket D — Definitional / AEO → short answer content + schema
`what is an interactive demo` (10) · `what is a product tour` (10, KD40) — thin volume but high AEO value (AI Overviews / ChatGPT cite definitions). Fold as FAQ + a glossary/definition block, not standalone pages.

---

## 4. pSEO backlog (exact entries to add)

### 4.1 New comparison pages → `lib/marketing/compare.ts`
Add typed `Comparison` entries (match existing voice; Tacto ✓ across `FEATURES`). **Note the framing difference:** Storylane/Navattic/Walnut are *interactive-demo* tools (no auto-capture/help-center) → lead on "capture + help center + free interactive mode"; Guidde is a *capture* tool (like Scribe) → lead on "interactive walkthroughs + branded help center + analytics".
- `guidde` — "Tacto vs Guidde"
- `storylane` — "Tacto vs Storylane"
- `navattic` — "Tacto vs Navattic"
- `walnut` — "Tacto vs Walnut"

### 4.2 New use-case pages → `lib/marketing/use-cases.ts`
- `knowledge-base` — target `knowledge base software` (301k) + `help center software`. The anchor page. Emphasize branded help center on own domain, search, analytics.
- `process-documentation` — target `process documentation software` (320, KD0) + `documentation tool` + `software documentation tool`.
- `user-onboarding` — target `user onboarding software` (110, KD9) + `in app onboarding` + `interactive walkthrough software`. (Distinct from the existing employee-`onboarding` page — this is *customer/product* onboarding.)

### 4.3 New blog posts → `lib/marketing/blog.tsx`
- `how-to-create-an-sop` — target `how to create an sop` (390, KD8).
- `how-to-create-a-user-guide` — target `how to create a user guide` (110, KD0).
- `how-to-document-a-process` — target `how to document a process` (50, KD5).
- `step-by-step-guide-template` — target `step by step guide template` (170, KD10); embed/link the `step-by-step-guide-maker` tool.
- (optional) `how-to-write-a-user-manual` — (30, KD0).

Each blog post = HowTo-structured, FAQ block at the end (AEO), internal links to the relevant use-case + tool + comparison pages.

---

## 5. AEO layer

1. **Schema (mostly done):** keep HowTo + FAQPage on guides; ensure every new blog post + use-case carries a `FAQPage` block (use-cases already have `faqs`; blog posts should render a JSON-LD FAQ from an added `faqs` field or inline).
2. **BreadcrumbList JSON-LD** (Batch B #4) — add to help hierarchy + marketing sub-pages. Helps SERP breadcrumbs and gives AI engines structure.
3. **Quotable answers:** each how-to post opens with a 2–3 sentence direct answer ("To create an SOP: 1) … 2) …") — the format AI Overviews / ChatGPT lift.
4. **Definitional FAQ:** answer `what is an interactive demo` / `what is a product tour` inside relevant pages.
5. **robots AI-bot allow-list** — already shipped. ✅

---

## 6. Technical / on-page remaining

- **Batch B #3** — per-content OG images for `/g`, `/showcase`, `/help`, `/f` (dynamic `ImageResponse`). Improves social CTR + card richness.
- **Batch B #4** — BreadcrumbList JSON-LD (see AEO).
- **On-page pass** — ensure landing, pricing, features, solutions title/H1/meta target Bucket C money terms without keyword-stuffing.
- **Internal linking** — comparison → use-case → tool → blog cross-links (topic clusters).
- **Optional:** submit key URLs via GSC URL Inspection after each batch ships.

---

## 7. Execution roadmap (prioritized batches)

| Batch | Work | Impact | Effort |
|---|---|---|---|
| **1. Comparison pages** | Add guidde, storylane, navattic, walnut to `compare.ts` | 🔴 High (KD0, buyer intent) | S |
| **2. Category use-cases** | Add knowledge-base, process-documentation, user-onboarding | 🔴 High (301k anchor + KD0) | M |
| **3. How-to blog posts** | 4–5 posts (Bucket B) w/ HowTo+FAQ schema | 🟡 Med-High (AEO + long tail) | M |
| **4. AEO polish** | BreadcrumbList + FAQ JSON-LD on new content + quotable intros | 🟡 Med | S |
| **5. OG images** | Per-content `opengraph-image` for public viewers | 🟢 Med (CTR) | M |
| **6. On-page + internal links** | Money-term on-page pass + topic-cluster links | 🟡 Med | S |
| **7. Measurement** | GSC sitemap submitted; set up rank tracker for target set; review at 2/4/8 wks | — | S |

---

## 8. Measurement

- **GSC:** domain property verified (Cloudflare TXT ✅). Submit `sitemap.xml`. Watch Indexed count + Performance (queries) weekly.
- **Rank tracker (OpenSEO):** track the Bucket A/B/C target keywords for tacto.fyi.
- **Success signals (first 8 weeks):** pages indexed; first impressions on `[competitor] alternatives` + `how to create an SOP`; then clicks. Category terms + `knowledge base software` are 3–6 month plays.
- **Credit note:** OpenSEO balance is low (~170). Keyword-metrics/ranked-keyword passes cost credits — top up before deep competitor mining.
