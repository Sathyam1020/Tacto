# Phase 11 — Forms — Implementation Plan (source of truth)

Companion to `docs/plans/phase-11-forms-rfc.md` (the approved design). This is the
concrete, file-by-file build plan. Work **strictly phase-by-phase**; after every phase:
`npx turbo typecheck lint build`, `npm test -w api`, `npm test -w worker`, fix everything,
**then** advance. Never break Guides. No TODO/placeholder code. STOP + explain on any
architectural conflict.

> Location note: kept in `docs/plans/` next to the RFC for consistency (the founder wrote
> `docs/plan/`; using the established `docs/plans/` convention).

## Approved adjustments (vs RFC)
- **Published version:** `Form.documentVersion Int @default(0)` increments on each successful
  publish; `FormSubmission.formVersion Int` records the version submitted against. Persist only
  — **no** version-history UI/comparison in this feature.
- **Guide embedding UI** goes in the **guide editor's customization dialog**
  (`customize-guide-dialog.tsx`) as a new section, alongside General/Brand/List/Interactive/Feedback.
  The embed remains an **overlay** (never a step) per RFC §10.

## Roadmap
1. Contracts + Database
2. Form CRUD + Draft/Publish API
3. Library + Sidebar + Form Card + Create flow
4. Builder
5. Public Form + Submission flow
6. Results + Analytics
7. Guide embedding (overlay, configured in guide customization)

Rollout = the phase order above. Each phase is independently releasable (feature invisible
until the rail button + routes land in Phase 3, and inert until a form is published).

---

## Phase 1 — Contracts + Database

**Contracts** — `packages/contracts/src/form.ts` (new):
- `fieldTypeSchema` (11 v1 types), `optionSchema`, `formFieldSchema` (key/type/title/description/required/config).
- `formThankYouSchema`, `formDesignSchema` (reuse `guideFontSchema`), `formSettingsSchema`.
- `formDocumentV1Schema`, `formDocumentSchema` (discriminated union on `v`), `type FormDocument`.
- `parseFormDocument` (migrate-on-read; v1 only today), `resolveFormDesign` (deep-merge defaults), `readFormDocument`.
- `formDraftPatchSchema` (`{ baseVersion, document }`).
- `submissionInputSchema` (`{ anonId?, answers, durationMs?, metadata?, formVersion }`) + `validateSubmission(fields, answers)` (server-authoritative).
- `createFormSchema` (`{ title, description?, folderId? }`), `renameFormSchema`, `updateFormSettingsSchema`.
- `packages/contracts/package.json`: add `"./form"` export.

**Database** — `packages/db/prisma/schema.prisma`:
- `enum FormStatus { DRAFT PUBLISHED }`.
- `model Form` (id, title, description, status, shareId @unique, publishedAt, pinnedAt, deletedAt, `document Json?`, `documentVersion Int @default(0)`, viewCount/startCount/submitCount, organizationId, createdById, folderId, relations `draft FormDraft?`, `submissions FormSubmission[]`, indexes `[organizationId,status]` + `[organizationId,folderId]`, `@@map("form")`).
- `model FormDraft` (formId @unique, document Json, version Int @default(1), updatedByUserId, timestamps, `@@map("form_draft")`).
- `model FormSubmission` (id, formId, anonId?, answers Json, `formVersion Int`, durationMs?, metadata Json?, createdAt, `@@index([formId, createdAt])`, `@@map("form_submission")`).
- `model Folder`: add `forms Form[]` back-relation.
- Migration: `add_forms`. Regenerate client.

**Tests:** contracts self-check test (parse/migrate `formDocumentV1Schema`, `validateSubmission` required/type/options/limits, `resolveFormDesign` merge) — add to an existing api test runner or a new `packages/contracts` check.

**Touches (must stay compiling):** none of Guides — `Folder.forms` is additive.

---

## Phase 2 — Form CRUD + Draft/Publish API

**API** — `apps/api/src/features/form/router.ts` (new), mounted `/api/forms` in `app.ts`:
- `assertForm(id, workspaceId)` (mirror `assertGuide`).
- `POST /api/forms` — `createFormSchema`; folder defaults to `ensureDefaultFolder`; seeds empty `FormDraft`; returns `{ form }`.
- `GET /api/forms` — workspace list (order `pinnedAt desc nulls last, createdAt desc`), with `submitCount`, `status`, `folderId`, etc.
- `GET /api/forms/:id` — detail (+ `hasUnpublishedChanges`).
- `GET /api/forms/:id/draft` — get-or-create, seed from `Form.document` via `buildFormDraft`; returns `{ document, version, isDirty }`.
- `PATCH`/`POST /api/forms/:id/draft` — `handleFormDraftSave` (optimistic concurrency; 409 `{currentVersion}`), mirror `handleDraftSave`.
- `POST /api/forms/:id/publish` — `$transaction`: parse draft → `Form.document = doc`, `status: PUBLISHED`, `publishedAt`, `shareId ??= nanoid(12)`, `documentVersion: { increment: 1 }`, version-guarded draft delete.
- `PATCH /api/forms/:id` (rename/description/settings), `POST /:id/pin`, `POST /:id/move`, `POST /:id/clone`, `DELETE /:id` (soft delete).
- `buildFormDraft(form)` (dirty-check anchor; parity with draft default).

**Contracts:** already in Phase 1.

**Tests** (`apps/api/src/features/form/*.test.ts`): draft 409 optimistic-concurrency; publish round-trip (`document`, `documentVersion` increments, `shareId` stable, `status`); dirty-check parity (fresh form not dirty); default-folder placement; `assertForm` cross-workspace 404.

**Touches:** `app.ts` (mount router). No guide code.

---

## Phase 3 — Library + Sidebar + Form Card + Create flow

**Web:**
- Wire the existing **Forms rail button** (`rail.tsx:277`): `active` on `/forms`, `onClick` → `router.push('/forms')` + set forms view.
- Forms library view state: clone `view-context.tsx` → `forms-view-context.tsx` (`tacto:forms-view`) OR parameterize; **decision: parallel provider** (lower risk).
- `FormsPanel` (clone `folders-panel.tsx`) — All forms / Pinned / Recent / Folders (folders filtered to forms; gate rename/delete on `!isDefault`). Mount in `app-shell.tsx` when the forms view is active (generalize `AppShell` to pick panel by view, or a small conditional).
- `apps/web/lib/forms.ts` — types (`FormListItem`), hooks: `useForms`, `useForm`, `useCreateForm`, `usePinForm`, `useMoveForm`, `useCloneForm`, `useDeleteForm`, `useFormDraft`, `useSaveFormDraft`, `usePublishForm`. Query keys `["forms", ...]`.
- `apps/web/lib/library.ts` — reuse `filterGuides`/`applyFilterSort`/`computeCounts` (parameterize generically over `{pinnedAt,folderId,status,createdAt,updatedAt}`), or thin wrappers.
- `apps/web/app/(app)/forms/page.tsx` — library page (clone `home/page.tsx`), grid of `FormCard` + New-form card.
- `FormCard` (`components/form-card.tsx`, clone `guide-card.tsx`) — chips: responses / completion / status; menu Pin/Move/Duplicate/Delete + confirm.
- `CreateFormDialog` — name + description → `useCreateForm` → `router.push('/forms/{id}/edit')`.

**Tests:** pure library helpers over `Form`.

**Touches:** `rail.tsx`, `app-shell.tsx` (panel selection), `lib/library.ts` (parameterize — keep guide behavior identical). Verify guides library unaffected.

---

## Phase 4 — Builder

**Web** — `apps/web/app/(app)/forms/[id]/edit/page.tsx` (chrome-free via `/edit`):
- Editor scaffolding mirrored from guide editor: `EditorDoc`/history (`editor-history.ts`)/`applyEdit`/autosave (`flush`,`scheduleFlush`)/draft cache (`draft-cache.ts`)/publish. Reuse the modules directly; clone the page shell.
- **Field list** (left) — ordered, drag-reorder, thank-you section; `EditableField` render (mirror `EditableBlock`).
- **Add-field palette** (`components/form-field-palette.tsx`) — searchable command palette (shadcn `Command`) over field types.
- **Right settings panel** — type, title, description, required, per-type config (options editor, min/max, placeholder, statement button text).
- **Design panel** (`components/form-design-panel.tsx`, clone `customize-guide-dialog.tsx` staging + color controls).
- **Center preview** — one-question-at-a-time render (shared `FormFieldView` reused by public fill).
- Top tabs: Build / Settings / Share; Preview action; Publish + save-state chip.

**Tests:** reuse editor test patterns if present (autosave/undo).

**Touches:** may **extract** shared editor helpers from `guides/[id]/edit/page.tsx` into `lib/` if cleanly reusable — only if it does not change guide behavior; otherwise clone. No guide behavior change.

---

## Phase 5 — Public Form + Submission flow

**API** — `apps/api/src/features/public/form-router.ts` (or extend public router), no auth:
- `GET /api/public/forms/:shareId` — `status:PUBLISHED` + `!deletedAt`; return `document` (+ current `documentVersion`); fire-and-forget `viewCount++`.
- `POST /api/public/forms/:shareId/start` — `startCount++` (idempotent-ish per anonId).
- `POST /api/public/forms/:shareId/submissions` — validate `submissionInputSchema` + `validateSubmission(publishedFields, answers)`; reject if `!settings.acceptingSubmissions`; create `FormSubmission` with `formVersion` = current `documentVersion`; `submitCount++`; return thank-you/redirect.
- Rate-limit submissions (per IP+shareId / anonId); payload cap.

**Web:**
- `apps/web/app/f/[shareId]/page.tsx` (+ `lib/public-form.ts` `fetchPublicForm`) — mirror `g/[shareId]`.
- `components/public-form-view.tsx` — one-question-at-a-time (frame/index/keyboard from `interactive-view`), progress bar, per-field validation, start beacon on first interaction, submit, closed-state, thank-you/redirect, `useAnonId`.
- `FormFieldView` shared with the builder preview.

**Tests:** submission accept/reject (required/type/options/closed); counters; `formVersion` recorded.

**Touches:** `public/router.ts` or a new sibling; `app.ts` if new router. No guide code.

---

## Phase 6 — Results + Analytics

**API** (`form/router.ts`, authed):
- `GET /api/forms/:id/submissions?cursor=&limit=` — paginated.
- `GET /api/forms/:id/submissions/export` — CSV.
- `GET /api/forms/:id/summary` — per-question aggregates.
- `GET /api/forms/:id/analytics?range=` — `{views,starts,submissions,completionRate,avgCompletionMs, trend:[{date,count}]}` (submissions/day).

**Web:**
- `apps/web/app/(app)/forms/[id]/page.tsx` — detail: **Form** preview tab + **Results** (Submissions / Summary / Analytics sub-tabs). Navbar: Edit / Share / Publish / overflow.
- `components/trend-chart.tsx` — internal SVG area chart (no dep), theme-aware.
- Submissions table + row drawer + CSV download; Summary bars; Analytics metric cards + `<TrendChart>`.

**Tests:** analytics aggregation (completion rate, avg time, trend buckets); summary per-type.

**Touches:** none of guides.

---

## Phase 7 — Guide embedding (overlay, in guide customization)

**Contracts** — `packages/contracts/src/guide.ts`: `formEmbedSchema` (`{id, formId, trigger: after-delay|after-step, style, dismissible, showOnce}`), `guideEmbedsSchema`, `readGuideEmbeds`. Add `embeds: guideEmbedsSchema.default([])` to `draftDocumentV3Schema` (in-place, like `faqs`). Add to `migrateDraftV2ToV3` (`embeds: []`), web `EditorDoc`/converters, `buildDraftDocument` seed.

**Database:** `Guide.embeds Json?` column. Migration `add_guide_embeds`.

**API:** `applyDraftContent` writes `embeds`; private `GET /guides/:id` + `public/router.ts` expose `embeds`; **public serialize resolves each `formId` → inline the referenced published form document** (fields+design) for instant fill; dirty-check parity (`readGuideEmbeds(null) === []`).

**Web (guide editor — customization):**
- `customize-guide-dialog.tsx`: **new "Forms" tab/section** — list embeds, add embed (pick published form via `useForms`, trigger after-step/after-delay seconds, style modal/sheet, show-once). Stage via existing `onApply`→`applyEdit(doc.embeds)`.
- `GuideDetail`/`PublicGuide` types + `serialize` gain `embeds` + resolved form docs.
- **Overlay rendering** (both views, NOT a sequence item):
  - `interactive-view.tsx`: delay timer (reuse autoplay clock, drives overlay not advance) + step-reached (frame index) → open overlay.
  - List view (`block-view`/`guide-view`): `IntersectionObserver` on step / mount timer → open overlay.
  - `components/form-embed-overlay.tsx` — `Dialog`/`Sheet` hosting `public-form-view` inline; `showOnce`/`dismissible` per anonId; submits with `metadata.guideId`.

**Tests:** embed dirty-check parity; publish round-trip of `embeds`; public serialize inlines the form.

**Touches (guide code — additive only):** `guide.ts` contracts, guide draft converters, `customize-guide-dialog.tsx`, `applyDraftContent`, guide serialize, `interactive-view.tsx`, guide list view. Guarded by dirty-check parity test; guides with no embeds behave identically.

---

## Architectural notes
- **No parallel systems:** reuse `Folder`/`ensureDefaultFolder`, `AppShell`/`Rail`/`shell-bits`, `editor-history`/`draft-cache`, `lib/library.ts` helpers, `useAnonId`, `nanoid` shareId, the optimistic-draft-save handler, and the customize-dialog color/staging pattern.
- **Published form = JSON document on `Form`** (not a `FormField` table): fields aren't queried relationally; submissions reference stable field `key`s; publish is a document copy + `documentVersion++`. Simpler than guides' `Step` table.
- **Embeds are overlays, never sequence items:** stored as `guide.embeds[]` (sibling to `interactive`), rendered by each view independently; `buildInteractiveSequence` untouched.
- **Dirty-check parity gotcha** (applies to `Form` draft defaults and `Guide.embeds`): the schema `default` and the `build*Draft` seed must be byte-identical, else everything shows dirty. Covered by tests in Phases 2 and 7.
