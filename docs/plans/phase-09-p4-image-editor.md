# Phase 9 · P4 — Global image editor (fabric.js)

Status: **In progress** · Scope: apps/web (editor modal + wiring), packages/contracts
(asset swap), reuses existing media upload/presign.

> A pencil icon on any screenshot → "Edit image" modal (fabric.js) with
> annotate/crop/blur tools. Saving flattens to a new PNG, uploads it as a **new
> R2 key**, and swaps that key across the shared **Asset** so the edit lands in
> **both** the List blocks and the Interactive step — global by construction.

## Why this is small plumbing on top of Phase 1–3

Phase 1 introduced the **Asset** (`{id,key}`) and put `assetId` on both List
blocks and Interactive step items; captured screenshots share one asset id.
"Update media" (Phase 3) already uploads a blob → key → sets screenshotKey/Url.
P4 = the same upload path + one new operation: **swap an asset's key
everywhere it's referenced**.

## Data / logic

- **`swapAssetKey(doc, assetId, newKey)`** (contracts, pure, tested): returns a
  new v2 doc with `assets[assetId].key = newKey`, and every List block AND
  Interactive step whose `assetId === assetId` updated to `screenshotKey =
  newKey`. Deterministic. Unit-tested for the both-trees invariant.
- **Page handler `replaceImage(source, newKey, newUrl)`** (client): mirrors the
  swap on the editor doc (`EditorDoc`), also setting the display `screenshotUrl`.
  - If `source.assetId` is set → global swap (both trees).
  - If null (media added ad-hoc, unlinked) → update only that one block/step by
    key. (Correct: an unshared image isn't global.)

No schema/API change — keys persist as today; `draftDocumentForClient` /
`serializeInteractive` presign on read. The old key is left in R2 (reaper later).

## Editor component — `components/image-editor.tsx`

fabric.js v6 (dynamic import → no SSR). Dialog with a canvas + toolbar.
- **Tools:** select/move, rectangle, ellipse, arrow, text, blur (pixelate a
  region), crop, undo/redo, delete, color, save/cancel. (Spotlight = follow-up.)
- **Undo/redo:** JSON snapshot stack of the canvas.
- **Blur:** overlay a Pixelate-filtered crop of the background over the drawn
  rect (canvas↔image coordinate mapping via the background scale).
- **Crop:** draw a rect → export only that region; new image = the crop.
- **Save:** `canvas.toBlob()` → PNG blob → upload (reuse `uploadStepMedia` with a
  `File`) → `{key,url}` → `replaceImage`.

## Wiring the pencil

- **Interactive step canvas** (`interactive-editor.tsx`): pencil top-right of the
  screenshot → opens the editor for that step's `{assetId, screenshotUrl}`.
- **List editor** (`block-view`/`EditableBlock`): pencil on the block screenshot →
  same.
- Only shown when a `screenshotUrl` exists.

## Also lands here (deferred from P3)

- **Slide background "upload your own"** — same upload path; store
  `background.value = key`, add `backgroundUrl` presigning to
  `serializeInteractive` + `draftDocumentForClient`. (Do after the editor core.)

## Order (each releasable)

1. `fabric` dep + `swapAssetKey` (contracts) + test.
2. `image-editor.tsx` (canvas + tools + save).
3. Wire pencil in Interactive editor + `replaceImage` page handler.
4. Wire pencil in List editor.
5. Slide background upload.
6. Verify: build, typecheck, tests; existing guides open; publish carries edits
   to both modes.

## Risks
- fabric bundle size (~) — dynamic import keeps it out of first load.
- Blur/crop coordinate mapping — needs care; unit-verify the swap, manual-verify
  the canvas.
- Old keys accumulate in R2 — acceptable for now (reaper is a separate task).
