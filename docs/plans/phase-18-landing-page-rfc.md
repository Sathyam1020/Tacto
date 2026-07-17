# Phase 18 — Landing Page (Guidejar-class, premium) — RFC

**Status:** Proposed · **Author:** Principal Eng · **Date:** 2026-07-17
**Domain:** `tacto.fyi` · **Scope:** `apps/web` marketing (`/`) · **Supersedes** the landing built in the prior pass (embed-heavy "slop").
**Refs the founder approved:** Guideflow + Guidejar navbars; Guidejar "how it works" (timeline), scroll/walkthrough demo, use-cases, features masonry, help-center bento.

> **Directive.** Take Guidejar's *structure* and beat it on execution — premium type, real motion, tasteful micro-interactions, zero clutter. The previous version failed two ways: (1) it was thin/generic, then (2) it became **iframe slop** (a live embed in every section — heavy and repetitive). This design uses **exactly two live embeds** as proof (hero + the list/walkthrough toggle) and makes everything else *designed* content: product screenshots, illustrations, a scroll-drawn timeline, and bento grids. Fully SSR, SEO/AEO/pSEO/ASO-ready, production-grade.

---

## 1. What went wrong / the correction

| Problem in the current build | Fix in this RFC |
|---|---|
| A live iframe in ~6 sections → slow, repetitive, "slop" | **2 embeds total**: hero (interactive) + the Scroll/Walkthrough toggle. Rest = optimized static screenshots + illustrations. |
| Generic gray-box or bland sections | Guidejar's section *variety*: timeline, illustrated cards, masonry bento, screenshot bento — each visually distinct. |
| Flat, no motion | A real motion system: scroll-reveal, timeline draw-in, staggered cards, toggle cross-fade, magnetic CTAs, marquee — all reduced-motion safe. |
| No display personality | A characterful **display face** + an editorial **italic accent** for sub-taglines (premium alternative to Guidejar's handwriting). |

---

## 2. Design language (the premium layer)

**Type (self-hosted via `next/font`, inlined — no CDN):**
- **Display** (headlines): a modern, tight, high-contrast grotesque with character — recommend **Clash Display** or **General Sans** (Fontshare, free) — *not* the childish rounded font. Big, confident, `text-wrap: balance`.
- **Body / UI:** keep **Geist** (Datum's face) — continuity with the app.
- **Mono:** **Geist Mono** for eyebrows, labels, stat units (the Datum "captured data" role).
- **Accent:** **Instrument Serif *italic*** (Google, free) for sub-taglines and pull quotes — editorial, premium; replaces Guidejar's handwriting while keeping the "human aside" feeling.

**Color / surface rhythm** (this is what makes Guidejar feel rich): alternate section grounds so the page breathes —
- **Light canvas** with a faint **dot grid** (use-cases, features) — `--l-canvas` + dotted mask.
- **Cobalt gradient** rich sections (how-it-works, output demo, help-center) — deep cobalt→ink mesh with soft glow, white/near-white cards on top. (Tacto's cobalt replaces Guidejar's purple.)
- **Accent:** cobalt only; sage/amber/rose from Datum reserved for tiny status ticks.

**Depth:** layered cards with a subtle *colored* drop shadow (the Guidejar card lift), 1px hairlines, inner glow on the accent, `rounded-2xl`/`rounded-3xl`.

**Motion principles** (use `motion/react` — already a dependency; no new lib):
- **Scroll-reveal:** sections/cards fade + rise 12–16px on enter (staggered), once.
- **Timeline draw:** the how-it-works connector line animates its height as you scroll past it; dots pop as each card reveals.
- **Toggle cross-fade:** Scroll ↔ Walkthrough swaps with a 200ms crossfade + height tween.
- **Micro-interactions:** magnetic/scale CTAs, card hover-lift, nav mega-menu spring, marquee, hero entrance stagger, subtle parallax on illustration layers.
- **Discipline:** everything behind `prefers-reduced-motion`; nothing loops distractingly; one "wow" moment (the timeline draw or the hero), quiet elsewhere.

**Theme:** the landing **commits to a light primary** with cobalt-gradient feature bands (matches the references, reads more "marketing," differentiates from the dark app). It owns its own theme (force-light, same mechanism as the public help center) so the app's dark default never bleeds in. *(Open Q1 if you'd rather keep dark.)*

---

## 3. Section-by-section spec (the exact structure you asked for)

**1 · Navbar** — sticky, blur, light. Left: reticle logo + "Tacto" wordmark. Center: **mega-menu dropdowns** (Guideflow/Guidejar style) — *Product ▾* (Guides, Interactive walkthroughs, Showcases, Help Center, Forms, Analytics), *Use cases ▾*, *Resources ▾* (Blog, Docs, Chrome extension, Changelog), *Pricing*. Right: **"Talk to us"** (ghost) + **"Start for free"** (cobalt). Mobile: hamburger → full drawer. Micro: dropdowns spring open on hover/focus with a soft shadow; active-link underline.

**2 · Hero — tagline + sub-tagline.** Display H1 (e.g., *"Record it once. Ship a guide people actually finish."*), Instrument-Serif-italic sub-tagline, dual CTA (*Start for free* / *See it live* → scrolls to demo), trust microcopy ("Free forever · No credit card"). Entrance stagger.

**3 · Hero demo — interactive (embed #1).** One **live interactive guide** (real `/embed/g/…?mode=interactive`) in a floating browser frame with 2–3 tasteful floating chips. This is the single hero proof; curated demo guide (not a random test recording).

**4 · Trusted by teams.** Logo **marquee** (grayscale, dual-row like Guideflow), "Trusted by fast-moving teams." Real logos when available; placeholder wordmarks until then.

**5 · How it works — vertical timeline.** Cobalt-gradient band. Display headline + italic sub ("From 'let me show you' to 'here's the link' in three steps"). A **left connector line that draws in on scroll**, dots that pop, and **3 staggered white cards** (Record / Customize / Share) each with an icon, title, copy. Exactly the Guidejar treatment, elevated with the draw animation.

**6 · Output demo — Scroll ⇄ Walkthrough toggle (embed #2).** The core interactive proof. Display headline ("And here's how good your guides look"), italic sub, then a **segmented toggle: "Scroll view" / "Walkthrough view"** that swaps the *same* real guide between `mode=list` and `mode=interactive` with a crossfade. One embed, two modes — shows the product doing its thing.

**7 · Use cases — illustrated 2×2.** Light dot-grid ground. Headline "How teams use Tacto across their business" + italic sub. **Four large cards**, each: a **gradient illustration header** + title (SOPs / Onboarding / Support / Product marketing …) + one line + "Learn more →" (links to `/use-cases/{slug}`, pSEO). Hover: card lift + illustration parallax.

**8 · Features — masonry bento + integrations.** Light ground. Accent headline "Everything your team will love." A **varied-width masonry** of feature cards (Guide formats, Interactive walkthroughs, AI voiceover, Translation, PDF/video export, Chapters, Conditional branching, Access control, Analytics, Help center widget) — some cards span 2 cols. Below: **"Embed anywhere on the web →"** + an integrations logo row (Notion, Confluence, Zendesk, Intercom, Slack, WordPress, HubSpot, "& more").

**9 · Help center overview — bento.** Cobalt-gradient band, book glyph, display headline "Build your own help center" + sub. A **bento**: 2 large cards up top with **real product screenshots** (the help-center reader + the drag-drop builder) labeled *MULTI LAYOUTS* / *QUICK SETUP*; 3 cards below (*Branding* illustration, *Custom domain* `help.yourcompany.com` on dot-grid, *Authentication* shield) — eyebrow + title + copy each.

**10 · Testimonials.** Light ground. Grid of quote cards with star row, avatar, name, role, company. (Optional: a marquee/auto-scroll row of logos + a featured quote.)

**11 · FAQ.** Accordion (`<details>` or animated), lead-with-the-answer copy, **`FAQPage` JSON-LD** mirroring it (AEO).

**12 · Final CTA + Footer.** Full-bleed cobalt CTA ("Stop explaining the same thing twice"). Multi-column footer (Product / Use cases / Resources / Company), Chrome-extension + social links, **SOC 2 / GDPR / CCPA** badges, "Made with Tacto."

---

## 4. Interactive components (small client islands; page stays SSR)

- `MegaMenu` + `MobileNav` (dropdowns, drawer, focus-trap, Esc).
- `DemoToggle` (Scroll/Walkthrough — swaps the embed src + crossfade).
- `Reveal` / `Timeline` (motion/react + IntersectionObserver; timeline height on scroll progress).
- `Marquee`, `FaqAccordion`.
- Everything else is server-rendered. Islands hydrate independently.

---

## 5. Assets required (the honest gap — needed to hit "production")

1. **Fonts:** license/self-host Clash Display (or General Sans) + Instrument Serif. *(free)*
2. **Illustrations:** 4 use-case + 2–3 help-center illustrations. Options: buy a cohesive set (e.g., a premium illustration pack), commission, or generate a consistent set. **Biggest asset dependency.**
3. **Curated demo guide(s):** 1–2 polished, generic guides (e.g., a well-known SaaS) for the hero + toggle — recorded intentionally, not test data. Live in a "Tacto Demo" workspace; referenced by env (`NEXT_PUBLIC_DEMO_GUIDE…`).
4. **Product screenshots:** help-center reader, builder, showcase — clean, retina, exported as optimized `next/image` assets (not live iframes).
5. **Brand:** OG image (`next/og`), favicon/app icons, real customer logos (or approved placeholders), avatars.

---

## 6. SEO / AEO / pSEO / ASO (baked in, ties to phase-17)

- **Technical:** SSR; `metadataBase = https://tacto.fyi`; canonical; `next/og` OG image; `robots.ts` (allow AI crawlers); `sitemap.ts`; manifest.
- **Schema (AEO):** `Organization` + `WebSite`(SearchAction) + `SoftwareApplication`(offers, rating) + `FAQPage`. Answer-first copy; FAQ block; freshness (`dateModified`).
- **pSEO hooks:** use-case cards → `/use-cases/{slug}`; feature cards → `/features/{slug}`; footer → `/compare/{competitor}`. Landing is the hub linking the programmatic pages.
- **ASO:** the "Chrome extension" CTA drives store installs (CTR = ranking signal); listing optimized separately (phase-17 WS-7).
- **Performance (this is SEO too):** only 2 iframes (lazy), everything else static/optimized → strong LCP/CLS. Fonts inlined, images sized, motion GPU-cheap.

---

## 7. Tech & architecture

- **Location:** `apps/web`, `(marketing)` route group, `/` = landing. Marketing owns its light theme (force-light island).
- **Rendering:** SSG/ISR for the page; the 2 embeds are `iframe loading="lazy"` (hero eager). Screenshots via `next/image`.
- **Motion:** `motion/react` (already installed). No new deps beyond fonts.
- **Structure:** `app/(marketing)/page.tsx` (server) composing section server-components + the client islands above; `components/marketing/*`.
- **Perf budget:** LCP < 2.0s, CLS < 0.05, JS island payload minimal.

---

## 8. Build plan (each phase independently shippable & green)

1. **Foundation:** fonts + design tokens + light-theme island + `MegaMenu`/`MobileNav` + hero (tagline/sub/CTA) + hero embed. *(the fold)*
2. **The two demos:** logo marquee + **timeline** how-it-works (with draw animation) + **Scroll/Walkthrough toggle** demo.
3. **Designed sections:** use-case illustrated cards + features masonry + integrations + help-center bento (with real screenshots).
4. **Proof + close:** testimonials + FAQ (+schema) + final CTA + footer.
5. **Motion & polish pass:** reveals, micro-interactions, reduced-motion, responsive down to mobile, a11y (focus, contrast, keyboard).
6. **SEO foundation:** metadata/OG/sitemap/robots/manifest/JSON-LD (folds in phase-17 WS-1).

---

## 9. Open questions (need your call)

1. **Theme:** light-primary with cobalt bands (matches refs, recommended) — or keep the dark aesthetic?
2. **Display font:** Clash Display (bolder/edgier) vs General Sans (cleaner/neutral)? And keep an italic-serif accent, or a subtle script for personality?
3. **Illustrations:** buy a pack / commission / generate — and what art style (flat vector like Guidejar, or 3D/gradient)? This gates sections 7 & 9.
4. **Demo content:** which product(s) should the curated hero + toggle guide feature? (Recognizable SaaS reads best.)
5. **Copy voice:** playful (Guidejar) vs confident-premium (Linear/Vercel)? Affects every headline.
6. **Scope for launch:** full page P1–P6, or land the fold + two demos first and iterate?

---

*On approval I'll start with Phase 1 (fonts, tokens, mega-menu, hero) so the top of the page is real and premium immediately, then build down. Flagging now: the **illustration assets** (Q3) are the one true blocker for sections 7 & 9 — everything else I can build with product screenshots + CSS.*
