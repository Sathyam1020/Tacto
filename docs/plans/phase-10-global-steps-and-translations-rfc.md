# RFC: Global steps, granular translations, and translation reliability

Status: **Proposed** · Scope: packages/db, packages/contracts, packages/ai,
apps/api, apps/web (editor + renderers + public)

> Three related asks:
> 1. **Steps should be global** — an edit to a step in List must show in
>    Interactive and vice-versa (today they're independent trees).
> 2. **Granular translation** — translate the whole guide first, then let the
>    user re-translate an individual step they've since edited.
> 3. **Bug** — the *first* translation of a guide errors; translating a second
>    language then shows both.

This RFC reverses the "two independent trees" decision from the Phase-9 RFC for
**step content**, while keeping Intro/Chapter slides as an Interactive-only
concept.

---

## 1. Background — where we are

- **List** = normalized `Step` rows (content, screenshot, clickRect, order).
- **Interactive** = `Guide.interactive` JSON: a full, **independent** copy of the
  steps (as `step` items) plus `intro`/`chapter` slides, per-step callout colors,
  and jump buttons. Seeded from the List, then diverges as edited.
- **Translations** = `GuideTranslation` rows; List keyed by **position**,
  Interactive by **stable key** (added in P5), reused across views by matching
  text.

The independence means a text/media/order/add/delete edit in one mode does not
appear in the other — which is the problem.

---

## 2. Problem 1 — make steps global

### 2.1 Goal
One canonical set of steps shared by both views. Editing a step's **text,
screenshot, order, or existence** in either mode reflects in the other.
Interactive keeps its **extras** (slides, per-step callout colors, jump buttons),
which have no List equivalent and stay Interactive-only.

### 2.2 Options

**Option A — Bidirectional sync (keep two trees, mirror the step parts).**
On every List step edit, also patch the matching Interactive `step` item by key
(and vice-versa); slides/colors stay Interactive-only.
- Pros: smallest data-model change; keeps P1–P5 intact.
- Cons: fragile. Reorder/add/delete must be mirrored while preserving slide
  interleaving; two sources of truth invite drift and edge-case bugs. Rejected as
  the long-term model.

**Option B — Single canonical step set + Interactive overlay.  ✅ recommended**
Collapse the duplicated step content back to the `Step` rows. `Guide.interactive`
stops storing step content/screenshots and becomes a thin **overlay**:

```
InteractiveOverlay {
  v: 3
  slides: Array<Slide & {
    anchor: { kind: "start" } | { kind: "afterStep", stepKey: string }
  }>
  stepStyle: { [stepKey]: { calloutBg: string|null, calloutText: string|null } }
}
Slide = intro|chapter { key, title, subtitle, appearance, buttons }
```

- The **Interactive sequence is computed at render**: take the `Step` rows in
  order; insert each slide at its anchor (`start` → before the first step;
  `afterStep` → immediately after that step). Steps therefore render from the
  shared source → **globally consistent by construction** (no sync code).
- **Per-step Interactive styling** (callout box/text color) lives in `stepStyle`,
  keyed by `stepKey`.
- **Reordering steps** happens on the shared steps (from either mode) and both
  views follow; anchored slides move with their step. **Deleting a step** drops
  its `stepStyle` entry and re-anchors its slides to the previous step (or
  `start`). **Reordering a slide** = changing its anchor.

Trade-off: Interactive can no longer have step **text** that differs from List.
That is exactly the requested behavior. Divergent per-step *presentation* (colors,
and later zoom/voiceover) is still supported via `stepStyle`.

### 2.3 Data model
- `Guide.interactive` keeps its column; its **shape changes to the overlay** (v3).
- `Step` gains nothing new (already has `key`). Callout colors move OUT of the
  interactive step item INTO `stepStyle`.
- Draft document V2 → **V3**: `interactive` becomes the overlay, not a step tree.

### 2.4 Migration (deterministic, additive-safe)
Migrate-on-read v2→v3 for drafts and `Guide.interactive`:
- For each existing interactive `step` item: drop its content/screenshot (List is
  canonical); if it had `calloutBg`/`calloutText`, write them to
  `stepStyle[stepKey]`.
- For each existing `intro`/`chapter` slide: keep it; set `anchor` = `afterStep`
  of the nearest preceding `step` item's key, or `start` if none.
- Where an Interactive step's text had **diverged** from its List block, the
  divergence is discarded (List wins). This is the intended semantics of "global";
  call it out in the changelog. (Optional nicety: if List text is empty but
  Interactive had text, copy Interactive→List during migration so nothing is
  silently lost.)

### 2.5 Editor UX after the merge
- **List mode**: unchanged (edits the shared steps).
- **Interactive mode**: the Steps rail still shows steps + slides; editing a
  step's callout **edits the shared step text** (so it updates List too). The
  color pickers write to `stepStyle`. Add Intro/Chapter still adds slides
  (anchored). "Update media" edits the shared step's screenshot (now global).
- The global **image editor** stays, but is simpler: one step = one screenshot,
  so an edit is inherently global. The `Asset` key-swap can be kept (nice for the
  editor's non-destructive swap) or simplified later.

### 2.6 Ripple effects
| Area | Impact |
|---|---|
| Draft/publish | Draft V3; `publishDraft` writes `Step` rows (as today) + the overlay. Migrate v2→v3 on read. |
| Renderers | `GuideBody`/`InteractiveView` build the interactive sequence from `Step` rows + overlay slides; apply `stepStyle` per step. |
| Translations | Now key by **stepKey** (see §3), since there's one step set — removes the position-keying hack. |
| Image editor | Simpler (single screenshot per step). |
| PDF/List | Unchanged (reads `Step` rows). |

### 2.7 Phasing (each shippable)
- **6.1** Contracts: overlay schema (v3) + migrate v2→v3 + render-sequence helper
  (`buildInteractiveSequence(steps, overlay)`). Tests. No UI change yet
  (renderers still work off the migrated data).
- **6.2** Publish/serialize/API write + read the overlay; renderers consume the
  sequence. Interactive now renders shared steps.
- **6.3** Editor: interactive step edits write to shared steps; colors →
  `stepStyle`; slides carry anchors; add/reorder/delete semantics.
- **6.4** Clean-up: remove dead two-tree code paths once 6.1–6.3 ship.

---

## 3. Problem 2 — granular (per-step) translation

### 3.1 Goal
Translate the **whole guide** the first time (as today). Afterwards, when the user
edits a single step, let them **re-translate just that step** without
re-translating (or re-paying for) the whole guide.

### 3.2 Keying change (enabled by the merge)
Today List translations key by **position** because publish recreated block ids.
With stable `Step.key` and a single step set, switch translation storage to
**key-addressed**: `GuideTranslation.steps = { [stepKey]: content }` (plus
`title`, `summary`, and slide/button entries by key). This makes per-step updates
trivial and removes the fragile index mapping.

Migration: convert existing `steps: [{index, content}]` → `{ [stepKey]: content }`
by pairing the guide's ordered `Step` rows with the stored indices at read time
(or a one-off backfill).

### 3.3 API
- Keep `POST /guides/:id/translations` (full guide) — unchanged behavior, new
  keying.
- Add `POST /guides/:id/translations/:language/step` with `{ stepKey }`:
  translate that one step's content into `language`, upsert into that language's
  `steps[stepKey]`. (Optionally accept `stepKey` + "all languages" to fan out.)
- The dedupe from P5 stays: shared text is translated once.

### 3.4 Editor UX
- Full "Add translation" as now.
- On a translated step the user edited, show a small **"Re-translate this step"**
  affordance (per language, or "all languages") in the step's edit surface.
- Mark a step's translation **stale** when its source text changed after the
  translation was generated (compare a hash/updatedAt), nudging a re-translate.

---

## 4. Problem 3 — first translation errors, second shows both

### 4.1 Symptoms
Translating the first language (e.g., Hindi) surfaces an error toast; translating
a second language then shows **both** languages. Implies the first request
actually **succeeded server-side** but the client treated it as failed.

### 4.2 Hypotheses (to confirm)
1. **AI latency vs. client timeout** — the first (cold) `translateGuide` call
   runs long; the browser/axios timeout fires and the mutation throws, but the
   server finishes and upserts the row. The next action refetches and shows both.
2. **Optimistic-update rollback** — `useAddTranslation`'s `onError` rolls the
   optimistic entry back, so the just-saved language vanishes from the UI until a
   later refetch.
3. **Response/parse issue** — the new P5 payload (interactive map) or a schema
   mismatch throws in the client handler after a 200.
4. **Cold-start / model init** — first `getModel()` call in the process errors,
   second succeeds.

### 4.3 Investigation + fix plan
- Reproduce and capture: network tab (did the POST return 200?), server logs, and
  the exact client error. That disambiguates 1–4.
- Likely fixes:
  - Raise the client timeout for the translate mutation (AI calls are slow) and/or
    make the endpoint respond fast + do work reliably.
  - On mutation error, **refetch** translations to reconcile (so a server-saved
    row appears instead of a phantom error). Make the create **idempotent** (it
    already `upsert`s by `(guideId, language)`), so a retry is safe.
  - Verify `onError` rollback doesn't drop a row that was actually persisted.
  - Add a regression test around the translate endpoint + client mutation.

---

## 5. Overall order
1. **Fix Problem 3 first** (small, high-value reliability fix; independent of the
   merge). Ship.
2. **Problem 1 (merge) 6.1 → 6.4** — the core architectural change. Ship per
   sub-phase.
3. **Problem 2 (granular translation)** — lands naturally on top of the merge's
   key-addressed steps.

## 6. Risks
- **Data loss on merge**: diverged Interactive step text is discarded (List wins).
  Mitigate with the "copy Interactive→List when List is empty" nicety and a clear
  changelog note. This is inherent to "make it global."
- **Migration correctness**: v2→v3 must be deterministic and cover slides'
  anchors + color extraction; unit-test with real drafts.
- **Two big moving parts** (merge + translation keying) — sequence them; don't
  land together.
- **Backwards compatibility**: existing guides/drafts/translations must open
  unchanged after migration; every migration additive + reversible-on-read.
