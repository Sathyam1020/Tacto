# Phase 9 · P5 — Translations for the Interactive tree

Status: **In progress** · Scope: packages/db, packages/contracts, packages/ai,
apps/api, apps/web.

> The List view already translates (per-block, keyed by position). The
> Interactive tree (step callouts + intro/chapter slides + jump buttons) still
> shows base-language text. P5 translates it too, **keyed by stable keys** (never
> position), and applies it in the public player.

## Keying

Interactive items have stable keys, so translations key by them:
- **step** callout HTML → `step.key`
- **slide** title → `${slide.key}#title`, subtitle → `${slide.key}#subtitle`
- **button** text → `button.key`

Stored per language as a flat `Record<string, string>` map.

## Data

- `GuideTranslation.interactive Json?` — the `{ key: translatedText }` map
  (additive, nullable; existing rows read null = no interactive translation).

## Contracts

- `guideTranslationAiSchema` gains `interactive: { id, content }[]` (the model
  returns each string by the same id).
- Helpers:
  - `collectInteractiveStrings(items)` → `{ id, content }[]` (steps + slide
    title/subtitle + buttons).
  - `applyInteractiveTranslation(items, map)` → items with translated text
    overlaid (falls back to base when a key is missing).

## AI

`translateGuide` input + prompt extended to also translate the interactive
strings (same id-preserving rules; HTML preserved for step callouts, plain text
for slide title/subtitle/buttons).

## API

- POST `/guides/:id/translations`: build interactive strings from the published
  `Guide.interactive` (seed from blocks if null), translate, store the map on
  `GuideTranslation.interactive`.
- GET (editor) + public payload: include `interactive` map on each translation.
- Publish already flips `published` on the whole row → interactive rides along.

## Web

- `PublicTranslation` gains `interactive: Record<string,string>`.
- Public view: when a language is active, overlay onto `guide.interactive.items`
  via `applyInteractiveTranslation` before passing to `GuideBody`.
- (Editor preview of interactive translation is out of scope for now — the
  List-mode translation preview modal stays as is.)

## Order (each releasable)

1. DB migration + schema.
2. Contracts (schema + helpers) + tests.
3. AI prompt/input.
4. API build/store/serialize.
5. Public overlay + types.
6. Verify: build, typecheck, tests; existing translations still work; a new
   translation localizes both List and Interactive; RTL still flips.

## Notes / risks

- AI cost grows with interactive strings — acceptable; interactive text overlaps
  the List content but can diverge, so it's translated independently.
- Deterministic keys mean re-generating a translation is stable across edits.
