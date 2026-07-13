# RFC: Mode-specific editing (List + Interactive), intro/chapter slides, global image editor

Status: **Proposed** · Scope: apps/web (editor + renderers), apps/api, packages/db, packages/contracts

> Goal: the two view modes become **independently editable** — like Guidejar's
> Scroll View and Walkthrough View. Text, block/slide structure, and order in
> one mode don't affect the other. The Interactive mode gains **Intro** and
> **Chapter** slides with jump-to-step buttons. **Screenshots stay shared** — a
> single, professional **image editor** edits an image once and it updates in
> both modes. A **List / Interactive selector** lives in the editor navbar.

Terminology (map to ours): Guidejar **Scroll View = our List mode**; Guidejar
**Walkthrough View = our Interactive mode**. This RFC uses **List** and
**Interactive**.

---

## 0. Current state

- A guide has **one** content tree: ordered `Step` (block) rows. **Both** the
  List renderer (`block-view`) and the Interactive renderer (`interactive-view`)
  read the same blocks. Editing a block changes both views.
- The editor (post draft/publish RFC) edits one draft document
  `{ title, summary, blocks[], customization }`, autosaves it, and publishes it
  by reconciling `Step` rows by `key`.
- Translations key by block **position**; reactions/comments/PDF all read the
  single block set.

The request breaks the "one tree feeds both views" assumption.

---

## 1. What changes conceptually

```
                 ┌── List tree (blocks: step/heading/tip/alert/outcome)      ── List renderer
Guide content ──►│
                 └── Interactive tree (items: step | intro | chapter)        ── Interactive renderer
                        (steps hold screenshot + callout; slides hold
                         title/subtitle/buttons/appearance)

Shared: screenshot ASSETS (R2 keys) + click rects. The image editor edits an
asset; the new key is swapped everywhere it appears in BOTH trees → "global".
```

- **Independent per mode:** block/slide **structure**, **order**, and **text**.
- **Shared across modes:** the **screenshot assets** (via key) and the guide-
  level bits (title, summary, customization). Editing an image is global.

Both trees are **seeded identically** from the captured steps when a guide is
first created (so existing guides look unchanged), then diverge as edited.

---

## 2. Data model

Two realistic options; **Option B recommended** for the least breakage.

### Option A — one V2 document, both trees as JSON
Store the whole guide content as a single versioned JSON blob with `list` and
`interactive`. Clean and symmetric, but it **abandons the normalized `Step`
rows**, which the public serializer, PDF, translations, reactions, and search
all depend on — a very large rewrite. **Not recommended now.**

### Option B — keep `Step` rows as the List tree; add an `interactive` JSON  ✅
- **List (Scroll)** content stays the **normalized `Step` rows** — canonical,
  and everything that already reads them keeps working (public list, PDF,
  translations, reactions, publish-by-key).
- **Interactive (Walkthrough)** content becomes a **JSON tree** on the guide.
- The editor's draft document grows to **V2**:

```
DraftDocumentV2 {
  v: 2
  title, summary, customization
  list: DraftBlock[]                 // unchanged shape (the Scroll tree)
  interactive: WalkthroughTree       // new
}

WalkthroughTree = { items: WalkthroughItem[] }

WalkthroughItem =
  | { key, kind: "step",    content, screenshotKey|null, clickRect|null, confidence|null }
  | { kind: "intro"|"chapter", key, title, subtitle,
      appearance: { background: {kind:"none"|"preset"|"image", value}, theme:"light"|"dark",
                    align:"left"|"center"|"right", buttonColumns: 1|2|3 },
      buttons: WalkthroughButton[] }

WalkthroughButton = { key, text, destination: {kind:"next"|"prev"} | {kind:"step", stepKey},
                      bgColor, textColor }
```

- **Storage on publish:** List → `Step` rows (as today, by `key`); Interactive →
  a new `Guide.interactive Json?` column. The draft's `v:1` documents migrate to
  `v:2` on read (migrate-on-read: `list = blocks`, `interactive.items = blocks
  mapped to step items`).
- **Shared assets:** step items and list step blocks reference the **same**
  `screenshotKey`. The image editor produces a new key and swaps it across both
  trees (§5), so an edit is global by construction.
- **Backfill:** for existing guides, seed `interactive` from the `Step` rows the
  first time the editor opens (in the V2 draft) and on the first publish.

### Schema (Prisma)
- `Guide.interactive Json?` — the published Interactive tree.
- No change to `Step` (still the List tree). Keep `Step.key` (already added).
- Draft doc `v` bumps to 2 (contracts).

---

## 3. Editor UX

### 3.1 Navbar mode selector
Add a **List / Interactive** segmented control to the editor navbar (per the
screenshot). Switching swaps which tree the canvas edits. Undo/redo, autosave,
draft status, and Publish stay **global** (one draft doc holds both trees; one
history stack; edit-count spans both). The mode toggle is view state, not a
separate document.

### 3.2 List mode editor (mostly today's editor)
- Renders `list` blocks with the existing block editor.
- **Fix: the `+` add-block affordance between steps is always visible** (today it's
  `opacity-0` until hover) — small CSS change.
- Otherwise unchanged (Step/Heading/Tip/Alert/Outcome, media, reorder).

### 3.3 Interactive mode editor (new)
A dedicated editor that renders the walkthrough one item at a time (reusing the
`interactive-view` stage) with edit affordances:
- **Left rail:** step/slide thumbnails (reorder, select, delete) — like Guidejar.
- **Canvas:** the selected item. Step items → screenshot + editable callout text
  + pointer. Intro/Chapter → the slide (title/subtitle/buttons) with an
  **Appearance** panel (background preset/upload, theme, alignment, button
  columns).
- **Mode toolbar** (only two buttons, per request): **+ Add Intro**, **+ Add
  Chapter**. (Guidejar's Captions/Autoplay/Brand/Navigation/Aspect-Ratio are out
  of scope — several already live in our Customize modal.)

### 3.4 Intro & Chapter slides
- **Intro** and **Chapter** are the same slide type; Intro conventionally sits
  first. Both: `title`, `subtitle`, `buttons`, `appearance`.
- **Buttons** (Edit Button modal): `text`, **destination** (Next step / Previous
  / a specific step from a dropdown of the walkthrough's steps), `bgColor`,
  `textColor`, delete. In the public Interactive player, clicking a button
  **jumps to its destination step**.

---

## 4. Public rendering
- **List mode** → renders `Step` rows (unchanged).
- **Interactive mode** → renders the published `interactive` tree: step items as
  today's walkthrough stage; intro/chapter slides as full slides with their
  appearance; buttons navigate (`next`/`prev`/jump-to-`stepKey`).
- The public view-mode toggle already exists; it now points each mode at its own
  tree. Default-view / only-scroll / only-walkthrough still apply.

---

## 5. Global image editor
A **pencil icon (top-right of a screenshot) → tooltip "Edit image" → modal**
with a production-grade editor:
- **Tools:** crop, blur/pixelate a region (redaction), rectangle/ellipse, arrow,
  freehand, text, highlight, undo/redo, reset.
- **Output:** flatten to a new PNG, upload as a **new R2 key**, then **swap the
  old key → new key across the entire draft doc (both trees)** so the edit is
  global. Original key is left in R2 (reaper later).
- **Build:** recommend **`fabric.js`** (mature canvas object model — shapes,
  text, freehand, serialization) or `tui-image-editor`. It's a real dependency
  (~).; flag it. Non-annotate ops (crop/blur) are plain canvas.
- **Editing state:** store the annotation objects (JSON) alongside the asset so a
  later edit is non-destructive (re-open the same annotations). Optional v2.

---

## 6. Ripple effects (this is the expensive part)

| Existing feature | Impact |
|---|---|
| **Draft/Publish** | Draft doc → V2 (two trees); `buildDraftDocument` seeds both; `publishDraft` applies List→Step rows AND Interactive→`Guide.interactive`; migrate-on-read v1→v2; `isDirty`/serialization updated. |
| **Translations** | Currently list-position-keyed. Decision: translate **both** trees (per-item, keyed by `key`) or keep list-only (Interactive shows original). Recommend translating both, keyed by `key` (now stable). |
| **PDF export** | Decide which tree exports (List is the natural "document"). Keep List → PDF; optionally an Interactive export later. |
| **Reactions/Comments** | Guide-level; unaffected. |
| **Customization** | Guide-level; unaffected (hotspot/brand/etc. apply to both). Autoplay/CTA/music are Interactive concerns already. |
| **Image editor** | New shared-asset swap touches both trees + publish. |
| **Search/cover** | Cover still from first step screenshot; fine. |

---

## 7. Migration
- Add `Guide.interactive Json?` (nullable, additive; no backfill needed).
- Draft docs migrate v1→v2 on read (list = blocks; interactive.items = steps).
- On first publish after upgrade, write `Guide.interactive` from the tree.
- Existing guides: Interactive mode is auto-seeded from their steps → unchanged
  look until edited. Fully backward-compatible.

---

## 8. Phasing (each shippable)
- **P0 — quick wins (independent, ship now):** always-visible `+` in List; add
  the List/Interactive **navbar selector** (still one tree underneath) to
  establish the UX; no data change.
- **P1 — data model:** `Guide.interactive`, draft V2 + migrate-on-read, seed both
  trees, publish both. No new UI yet — Interactive renders the seeded tree
  (looks identical). Tests.
- **P2 — Interactive editor:** thumbnails rail + per-item editing + reorder/
  delete, editing the Interactive tree independently of List.
- **P3 — Intro/Chapter slides + buttons + jump-to-step** (editor + public
  player).
- **P4 — Global image editor** (fabric.js) with cross-tree key swap.
- **P5 — Translations across both trees** (if we decide to).

---

## 9. Risks
- **Largest feature yet** — it reopens the content model we just stabilized
  (draft/publish). Multi-phase, weeks of work.
- **Two trees drift** — reorder/delete semantics, and keeping shared assets in
  sync, need care (the image-editor key-swap is the main coupling).
- **Translations × 2 trees** multiplies AI cost + keying complexity.
- **Image editor scope creep** — "production-grade" is a big surface; timebox to
  crop/redact/annotate/arrow/text first.
- **Storage** — Interactive JSON can grow; keep screenshots as keys (small).

---

## 10. Open decisions (need your call)
1. **Data model:** Option B (Step rows for List + `interactive` JSON) — agree?
2. **Translations:** translate both trees, or List-only for now?
3. **PDF:** List-only export (recommended) or add Interactive export?
4. **Image editor library:** `fabric.js` (recommended) vs `tui-image-editor` vs
   hand-rolled canvas — and is a new ~100–200KB dep acceptable?
5. **Divergence default:** when you first edit Interactive, it forks from the
   seeded steps. Reordering/deleting a step in List should it affect Interactive?
   Recommend **no** (fully independent once V2 exists) — confirm.
6. **Scope of Interactive toolbar:** just **Add Intro + Add Chapter** (per
   request), correct? (Everything else stays in Customize.)

---

## 11. Recommendation
Adopt **Option B**. Ship **P0 quick wins now** (always-visible `+`, navbar
selector) for immediate value, then build **P1 (two-tree data model)** as the
foundation, followed by the **Interactive editor (P2)**, **Intro/Chapter +
buttons (P3)**, the **global image editor (P4)**, and finally **cross-tree
translations (P5)** if desired. Keep screenshots shared-by-key so the image
editor is global by construction, and keep List on `Step` rows so nothing we've
built breaks. This is a multi-phase project — approve the model + decisions in
§10 and I'll start with P0.
