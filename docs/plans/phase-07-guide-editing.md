# Phase 07 — Guide Editing Features (Guidejar parity)

> Goal: everything shown in the reference screenshots — Customize Guide (6 tabs,
> Form excluded), Add translations, Add voiceovers (dummy), Import Steps, Sort
> steps, Export. No premium gating for now (gating is a separate future pass).
>
> Terminology map: **Scroll View = List view**, **Walkthrough View = Interactive
> view**, **Hotspot = click pointer/reticle**, **Step image = screenshot**.

---

## 0. Where these live in the product

A new **guide toolbar** on the guide view page (and/or the editor) with:
`Customize Guide · Add translations · Add voiceovers · Import Steps · Sort steps · Export Guide`

All customization is stored on the guide and **applied in three renderers**:
- **In-app guide view** (`guide-view.tsx` → `block-view.tsx` / `interactive-view.tsx`)
- **Public guide** (`/g/[shareId]` → `public-guide-view.tsx`)
- **PDF export** (`lib/pdf.ts`)

---

## 1. Data model changes

### 1.1 `Guide.customization Json?`
One JSON blob (null = defaults). Zod-typed in `@workspace/contracts/guide`. Shape:

```ts
GuideCustomization = {
  general: {
    defaultView: "scroll-default" | "walkthrough-default" | "only-scroll" | "only-walkthrough"
    pageLayout: "extremely-narrow" | "narrow" | "moderate" | "wide" | "extremely-wide"
    hotspot: {
      type: "default" | "glowing-circle" | "cursor" | "highlight-box"
      size: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2        // "Default" = 1
    }
  }
  brand: {
    logoUrl: string | null
    color: string                                          // hex, e.g. "#5e6ad2"
    font: "DM Sans" | "Inter" | "Geist" | "Roboto" | "Poppins" | "Montserrat" | "Lato" | "Open Sans"
    rtl: boolean
  }
  scrollView: {
    navigationBar: boolean                                 // only applies to narrow/moderate layouts
    initialZoom: 1 | 1.5 | 2
    zoomDelay: number                                      // 0.0 – 2.0 s (0.1 steps)
    imageScaling: "fit-to-width" | "native-size"
  }
  walkthroughView: {
    textAnnotations: boolean
    showStepCounter: boolean
    useMarkdown: boolean
    zoomLevel: "no-zoom" | 1.1 | 1.2 | … | 2
    optimizeForMobile: boolean
    autoplay: { enabled: boolean; delaySeconds: number; loop: boolean }
    cta: { enabled: boolean; title: string; subtitle: string; buttonText: string; buttonUrl: string }
    backgroundMusic: { url: string | null; volume: number }   // 0–1
  }
  feedback: { allowReactions: boolean; allowComments: boolean }
}
```
A `DEFAULT_CUSTOMIZATION` constant powers "Apply Default Customization".

### 1.2 Per-step overrides — `Step.settings Json?` (+ media fields)
Guidejar allows per-step overrides for Image Scaling and Walkthrough Zoom. Add to
the `Step` model:
- `settings Json?` → `{ imageScaling?, zoomLevel? }` (override the guide default)
- `voiceoverUrl String?` (reserved for the real voiceover feature; unused now)

### 1.3 Translations — `GuideTranslation`
```
model GuideTranslation {
  id, guideId (FK, cascade), language (e.g. "es","fr"),
  title String, steps Json,   // [{ blockId, content }] translated
  createdAt, updatedAt
  @@unique([guideId, language])
}
```

### 1.4 Feedback — `GuideReaction` + `GuideComment`
```
model GuideReaction { id, guideId, emoji String, anonId String, createdAt  @@unique([guideId, anonId, emoji]) }
model GuideComment  { id, guideId, authorName String, authorId String?, body String, createdAt }
```

### 1.5 Migrations
One migration adding: `guide.customization`, `step.settings`, `step.voiceoverUrl`,
and the three new tables.

---

## 2. Phase A — Customization modal + application (the bulk of the value)

### 2.1 The modal (`components/customize-guide-dialog.tsx`)
- Header: **Apply Default Customization** (top-right). Footer: **Save customization / Close**.
- Tabs: **General · Brand · Scroll View · Walkthrough View · Feedback** (Form omitted).
- Local draft state; Save → `PATCH /api/guides/:id/customization`. Optimistic + toast.
- Full light/dark styling, matching the Datum system (not Guidejar's purple).

**General tab**
- Default View — dropdown: Scroll default / Walkthrough default / Only Scroll / Only Walkthrough.
- Page Layout — dropdown: Extremely Narrow / Narrow / Moderate / Wide / Extremely Wide.
- Hotspot Type — dropdown with previews: Default / Glowing Circle / Cursor / Highlight Box.
- Hotspot Size — dropdown: 0.5x / 0.75x / Default / 1.25x / 1.5x / 1.75x / 2x.

**Brand tab**
- Logo — upload to R2 (`brand/{org}/…`); preview + remove.
- Brand Color — hex input + color picker (a small HSV picker or `<input type=color>` + hex field).
- Font — dropdown of the curated set (loaded via `next/font`, self-hosted so CSP-safe).
- RTL Layout — toggle.

**Scroll View tab**
- Navigation Bar — Yes/No (disabled unless layout ∈ narrow/moderate).
- Initial Zoom — 1 / 1.5 / 2.
- Zoom Delay — 0.0–2.0s dropdown (0.1 steps).
- Image Scaling — Fit to width / Native size.

**Walkthrough View tab**
- Text annotations (toggle) · Show step counter (toggle) · Use Markdown (toggle)
- Zoom Level — No Zoom / 1.1x … 2x.
- Optimize for mobile (toggle)
- **Autoplay** — toggle + Delay (seconds) + Loop toggle.
- **Call-to-Action** — toggle + Title / Subtitle / Button Text / Button URL.
- **Background Music** — audio upload (R2) + volume.

**Feedback tab**
- Allow Reactions (toggle) · Allow Comments (toggle).

### 2.2 Applying customization (the real engineering)
- **Contracts + API:** `customizationSchema`; `PATCH /api/guides/:id/customization`; include `customization` in the guide GET + the public guide payload.
- **Default View:** the guide/public view respects it — pick initial mode + lock the toggle for "Only" options.
- **Page Layout:** map to a max-width on the content container (all three renderers).
- **Hotspot Type + Size** (`screenshot-frame.tsx`): render 4 pointer variants (Default reticle, Glowing Circle, Cursor, Highlight Box), scaled by size. Applies to list + interactive + PDF (PDF composites the chosen hotspot).
- **Scroll View:** Navigation Bar (a step-nav strip in list view for narrow layouts), Initial Zoom + Zoom Delay (zoom toward the hotspot as a step scrolls into view), Image Scaling (fit-to-width vs native).
- **Walkthrough View:** honor text-annotations/counter/markdown/mobile/zoom-level toggles in `interactive-view.tsx`.
- **Brand:** logo in the public header; brand color as the guide accent (buttons, pointer, progress) via a scoped CSS var; font applied to the guide surface; `dir="rtl"` when RTL (view + PDF).

**Files:** `contracts/guide.ts`, `api/features/guide/*`, `web/lib/guides.ts` + `public-guide.ts`, `customize-guide-dialog.tsx`, `guide-view.tsx`, `block-view.tsx`, `interactive-view.tsx`, `screenshot-frame.tsx`, `public-guide-view.tsx`, `lib/pdf.ts`.

---

## 3. Phase B — Sort steps (self-contained quick win)
- Modal `sort-steps-dialog.tsx`: drag-to-reorder list (dnd), **Shift-click range select** to move a group. Numbered rows + drag handles.
- On save → write new `position`s via the existing guide update (`PUT /api/guides/:id`) or a dedicated `POST /api/guides/:id/reorder`.
- Reuses block content; purely reorders.

---

## 4. Phase C — Import Steps
Modal `import-steps-dialog.tsx` → choose a source:
1. **Import from other guides** — pick one of your guides → copy its `Step` blocks (deep-copy content + screenshots by reference) appended to the current guide.
2. **Import Screenshots** — multi-upload images → R2 → create a STEP per image (screenshot + editable caption).
3. **Import from DOCX (⚡AI)** — upload a `.docx` → parse (server) → AI extracts an ordered step list → create STEP blocks.
4. **Import from PDF (⚡AI)** — upload a `.pdf` → parse pages/text → AI extracts steps → create STEP blocks.
- New API routes: `POST /api/guides/:id/import/{from-guide,screenshots,docx,pdf}`. DOCX/PDF run through the worker's AI (a new "extract steps from document" prompt) with a doc parser (`mammoth` for docx, `pdf-parse`/existing poppler for pdf).

---

## 5. Phase D — Translations
- Modal `translations-dialog.tsx`: FROM (source lang) → **Add Language**; shows Title + each step; **AI-translates** on add and stores a `GuideTranslation`; edit inline; credits indicator.
- Worker gets a `translateGuide(text[], targetLang)` AI helper.
- Public guide: a **language switcher**; selecting a language swaps title/step text from the stored translation (screenshots unchanged).
- API: `POST /api/guides/:id/translations`, `GET/DELETE` per language.

---

## 6. Phase E — Walkthrough extras & Feedback (the heavy ones)
- **Call-to-Action:** interactive view shows a final CTA slide (title/subtitle/button→URL) when enabled.
- **Autoplay:** interactive view auto-advances every `delaySeconds`, optional loop; play/pause control. (This is the previously-deferred auto-play; now built.)
- **Background Music:** upload audio → play on loop in the public walkthrough at the set volume; mute control.
- **Reactions:** public guide shows reaction buttons; `GuideReaction` stored per anon id.
- **Comments:** public/in-app comment thread; `GuideComment` CRUD (team-only in-app; public if allowed).

---

## 7. Add voiceovers — dummy
A toolbar entry that opens a small "Voiceovers — coming soon" dialog (or a disabled button with a tooltip). No backend. (The real per-step AI voiceover is a later feature; `Step.voiceoverUrl` is reserved.)

---

## 8. Export Guide
Already implemented (PDF). Update it to honor **brand color**, **RTL**, and the
selected **hotspot type** when compositing pointers.

---

## 9. Build order & sequencing
1. **Data model + contracts + `PATCH customization`** (foundation).
2. **Phase A** — customization modal + apply everything non-heavy (General, Brand, Scroll, Walkthrough toggles/zoom/mobile, Feedback toggles-as-settings) across the 3 renderers. *This is the biggest chunk and the most visible.*
3. **Phase B** — Sort steps.
4. **Phase C** — Import Steps (from-guide + screenshots first; DOCX/PDF after).
5. **Phase D** — Translations.
6. **Phase E** — CTA → Autoplay → Background Music → Talking Head → Reactions → Comments.
7. **Voiceovers dummy** (anytime; trivial).
8. **Export** RTL/brand/hotspot pass.

Each phase is independently shippable, typchecks + builds green, and (where it has
logic like the hotspot renderer or reorder) gets a small fixture/test.

---

## 10. Decisions locked (from product owner)
- Build **all** features in the images; **no gating** now (separate future pass).
- **Form** tab: excluded.
- **Add voiceovers:** dummy button only.
- **Talking Head:** dropped from scope.
- **DOCX/PDF import:** built (AI parsing pass).

## 11. Open notes / defaults chosen unless overridden
- **Fonts:** a curated self-hosted set (DM Sans, Inter, Geist, Roboto, Poppins, Montserrat, Lato, Open Sans) so the CSP/offline-safe requirement holds.
- **Styling:** the modals follow **Tacto's Datum design system** (cobalt/light+dark), not Guidejar's purple — same features, our look.
- **Brand color** recolors the guide's accent (pointer, buttons, progress) in the *published/public* guide, not the whole app.
- **Reactions/Comments** on the public guide use an anonymous id (localStorage) since public viewers aren't authed.
