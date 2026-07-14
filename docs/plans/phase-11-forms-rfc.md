# Phase 11 — Forms (builder · fill · results · guide-embedding) — RFC

**Status:** Proposed · **Author:** Principal Eng · **Date:** 2026-07-15
**Scope:** `apps/web`, `apps/api`, `apps/worker` (minimal), `packages/{contracts,db,ui}`

---

## 1. Summary

A first-class **Forms** subsystem that mirrors the Guides architecture end-to-end and reuses its infrastructure wherever possible (draft-first, publish-later, workspace-scoped, folder-organized):

- **Library** — its own sidebar view (All forms / Pinned / Recent / Folders), reusing the shell (`AppShell`/`Rail`/`FoldersPanel`) and a `FormCard` cloned from `GuideCard`. Forms live in the **same `Folder` rows** as guides (default **General**, permanent).
- **Create** — a genuine blank create: a **name + description** dialog → `POST /api/forms` → redirect to `/forms/{id}/edit` (guides are capture-derived; this is net-new).
- **Build** — a form builder that mirrors the guide editor's **draft document + optimistic autosave + publish** machinery verbatim (`FormDraft`, `applyEdit`, undo/redo, offline cache, version-guarded save). Field list + searchable block palette + live preview + right-hand settings + a Design panel.
- **Fill** — a public one-question-at-a-time form at `/f/{shareId}`, submitting to a no-auth endpoint. Reuses the walkthrough player's frame/index pattern.
- **Results** — Submissions / Summary / Analytics on the form detail page, with metric cards, a submissions-over-time trend chart (hand-rolled SVG), per-question summaries, and CSV export.
- **Embed in guides** — a form shown inside a guide **after a specific step** or **after N seconds**, reusing the guide's presentation/anchor + autoplay-timer mechanics.

### Guiding principles (from the existing codebase philosophy)
Draft first · Publish later · No duplicate systems · Reuse existing infrastructure · Every phase compiles/lints/tests/ships · Never silently change existing behavior.

### Non-goals (v1 — deferred)
- File-upload, Multi-Question-Page (nested), Contact-Info composite, Payment, Signature field types.
- Conditional **Logic** (branching) and the **Integrate** tab (webhooks/Zapier).
- Per-question **drop-off** analytics (needs per-field view events) and a **Views-over-time** trend (needs a view-event log). v1 ships scalar view/start counters + a **submissions**-over-time trend.
- Form **translations** (base language only; the guide translation pipeline can be applied later).
- Drag-to-reorder is **in** for fields (guides already reorder), but multi-select/bulk on the forms library is deferred.

---

## 2. Field types (v1)

| Type | Input | Type-specific config |
|---|---|---|
| `statement` | none (display only) | `buttonText` |
| `short_text` | single-line | `placeholder`, `maxLength` |
| `long_text` | multi-line | `placeholder`, `maxLength` |
| `email` | email | `placeholder` |
| `phone` | tel | `placeholder` |
| `number` | number | `min`, `max`, `placeholder` |
| `single_select` | radio | `options[]`, `allowOther` |
| `multi_select` | checkbox | `options[]`, `allowOther`, `min`, `max` |
| `dropdown` | select | `options[]` |
| `rating` | 1–N stars | `max` (default 5) |
| `date` | date | `min`, `max` |

Every field shares: `key` (stable uuid), `type`, `title` (question), `description?`, `required`. Deferred types (`file`, `multi_question`, `contact_info`) slot into the same discriminated union later without a redesign.

---

## 3. Data model (`packages/db/prisma/schema.prisma`)

Mirrors `Guide`/`GuideDraft`/`GuideReaction`. **Published form content is a JSON document on `Form`** (not a relational `FormField` table) — fields aren't queried relationally, submissions reference stable field `key`s, and publish becomes a simple document copy (no reconcile-by-key). This is *simpler* than guides (which use the `Step` table only because steps carry media + are queried).

```prisma
enum FormStatus { DRAFT PUBLISHED }

model Form {
  id          String     @id @default(uuid())
  title       String
  description String?
  status      FormStatus @default(DRAFT)
  shareId     String?    @unique          // nanoid(12), minted on first publish, stable
  publishedAt DateTime?
  pinnedAt    DateTime?                    // Pinned view (mirrors Guide.pinnedAt)
  deletedAt   DateTime?                    // soft delete

  /// Published form document — { v, fields, thankYou, design, settings }.
  /// Null until first publish. Shape = FormDocument in @workspace/contracts/form.
  document Json?

  /// Analytics counters (fire-and-forget increments; never block a response).
  viewCount   Int @default(0)
  startCount  Int @default(0)
  submitCount Int @default(0)

  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdById    String
  createdBy      User         @relation(fields: [createdById], references: [id], onDelete: Cascade)
  folderId       String?
  folder         Folder?      @relation(fields: [folderId], references: [id], onDelete: SetNull)

  draft       FormDraft?
  submissions FormSubmission[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([organizationId, status])
  @@index([organizationId, folderId])
  @@map("form")
}

model FormDraft {
  id              String   @id @default(uuid())
  formId          String   @unique
  form            Form     @relation(fields: [formId], references: [id], onDelete: Cascade)
  document        Json                       // FormDocument (versioned), edited by the builder
  version         Int      @default(1)       // optimistic-concurrency counter
  updatedByUserId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("form_draft")
}

model FormSubmission {
  id         String   @id @default(uuid())
  formId     String
  form       Form     @relation(fields: [formId], references: [id], onDelete: Cascade)
  anonId     String?                          // localStorage anon id (dedupe / spam heuristics)
  answers    Json                             // { [fieldKey]: value } against the published fields
  durationMs Int?                             // client-measured start→submit (Completion Time)
  metadata   Json?                            // { device, referrer, guideId? } (embed provenance)
  createdAt  DateTime @default(now())
  @@index([formId, createdAt])
  @@map("form_submission")
}
```

**Folder reuse** — add `forms Form[]` to the existing `Folder` model (alongside `guides`, `captures`). `ensureDefaultFolder`/`getDefaultFolderId` (`packages/db/src/index.ts:43`) and the delete-guard (`folder/router.ts:137` rejects deleting `isDefault`, reassigns children to General) apply unchanged — the delete transaction must additionally reassign the folder's **forms** to General.

Migration: `add_forms` (new tables + enum + `Folder.forms` back-relation; no data backfill).

---

## 4. Contracts (`packages/contracts/src/form.ts`, new)

Mirrors `guide.ts`'s versioned, migrate-on-read document + `resolveCustomization`-style deep-merge.

```ts
export const fieldTypeSchema = z.enum([
  "statement","short_text","long_text","email","phone","number",
  "single_select","multi_select","dropdown","rating","date",
]);

const optionSchema = z.object({ key: z.string().min(1), label: z.string().max(300) });

// Base + type-specific config (kept loose per type; strict AI schemas not needed here).
export const formFieldSchema = z.object({
  key: z.string().min(1),
  type: fieldTypeSchema,
  title: z.string().max(500).default(""),
  description: z.string().max(2000).default(""),
  required: z.boolean().default(false),
  config: z.object({
    placeholder: z.string().max(200).default(""),
    maxLength: z.number().int().positive().nullable().default(null),
    min: z.number().nullable().default(null),
    max: z.number().nullable().default(null),
    options: z.array(optionSchema).max(50).default([]),
    allowOther: z.boolean().default(false),
    buttonText: z.string().max(80).default(""),
  }).default({}),
});

export const formThankYouSchema = z.object({
  title: z.string().max(300).default("Thank you!"),
  description: z.string().max(2000).default(""),
});

export const formDesignSchema = z.object({
  background: z.string().default("#ffffff"),
  question: z.string().default("#111111"),
  answer: z.string().default("#111111"),
  button: z.string().default("#5e6ad2"),          // brand cobalt default (Datum)
  buttonText: z.string().default("#ffffff"),
  font: guideFontSchema,                            // reuse the 8-font enum
  align: z.enum(["left","center"]).default("left"),
});

export const formSettingsSchema = z.object({
  acceptingSubmissions: z.boolean().default(true), // "close form" toggle
  closedMessage: z.string().max(500).default("This form is no longer accepting responses."),
  showProgressBar: z.boolean().default(true),
  redirectUrl: z.string().url().nullable().default(null),
});

export const formDocumentV1Schema = z.object({
  v: z.literal(1),
  title: z.string().max(200),
  description: z.string().max(2000).nullable(),
  fields: z.array(formFieldSchema).max(200),
  thankYou: formThankYouSchema.default({}),
  design: formDesignSchema.default({}),
  settings: formSettingsSchema.default({}),
});
export const formDocumentSchema = z.discriminatedUnion("v", [formDocumentV1Schema]);
export type FormDocument = z.infer<typeof formDocumentV1Schema>;

// Autosave PATCH body — identical shape to draftPatchSchema.
export const formDraftPatchSchema = z.object({
  baseVersion: z.number().int().nonnegative(),
  document: formDocumentSchema,
});

// Public submission (validated against the published field set at the endpoint).
export const submissionInputSchema = z.object({
  anonId: z.string().max(64).nullish(),
  answers: z.record(z.string(), z.unknown()),   // per-field validation done server-side
  durationMs: z.number().int().nonnegative().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export function parseFormDocument(raw): { success; data?; error? } // migrate-on-read (v1 today)
export function resolveFormDesign(raw): FormDesign                  // deep-merge with defaults
export function readFormDocument(raw): FormDocument | null          // for published reads
```

Field-answer validation (submissions) is derived from the published `fields`: required present, type coercible, `options` membership, `min/max`/`maxLength`. A small `validateSubmission(fields, answers)` helper lives in `packages/contracts` and is used by the submit endpoint (server-authoritative).

---

## 5. Draft / publish (mirror guides exactly)

The guide editor's draft machinery is reused near-verbatim; only names change.

- **Autosave** — `FormDraft` + `formDraftPatchSchema`. `POST/PATCH /api/forms/:id/draft` reuses the `handleDraftSave` optimistic-concurrency handler (`guide/router.ts:262`): `updateMany({ where:{ formId, version: baseVersion }, data:{ document, version:{increment:1} } })`; `count===0 → 409 { currentVersion }`.
- **Get-or-create draft** — `GET /api/forms/:id/draft` seeds a fresh draft from `Form.document` via `buildFormDraft(form)` (the dirty-check anchor), returns `{ document, version, isDirty }`.
- **Publish** — **single** `POST /api/forms/:id/publish` (forms combine content + visibility, unlike guides' two-step): a `$transaction` that `parseFormDocument`s the draft, writes `Form.document = doc`, sets `status: PUBLISHED`, `publishedAt`, mints `shareId = form.shareId ?? nanoid(12)`, then version-guarded `deleteMany({ formId, version: draft.version })` (`SupersededError` → no-op). Re-publish keeps `shareId` stable.
- **Dirty check** — `hasUnpublishedChanges = !isDeepStrictEqual(parseFormDocument(draft), buildFormDraft(form))`. `buildFormDraft` and the draft `default`s must be byte-identical (same gotcha as FAQ — covered by a test).
- **Close / reopen** — `settings.acceptingSubmissions` toggles accepting submissions without unpublishing.

**Web** reuses `editor-history.ts`, `draft-cache.ts`, and the `applyEdit`/`flush`/`scheduleFlush`/`persistCache` scaffolding from `guides/[id]/edit/page.tsx` (extracted where practical, or cloned into the form editor).

---

## 6. Form builder — `apps/web/app/(app)/forms/[id]/edit/page.tsx`

Route ends `/edit` → the shell auto-selects `EditorChrome` (chrome-free), same as guides. Mirrors the guide editor's `EditorDoc`/`applyEdit`/undo/autosave/publish.

**Layout** (matches the Youform inspo, in Tacto's Datum theme — cobalt/cool/Geist/light, *not* Youform's yellow):
- **Top bar** — form title (editable) · tabs **Build · Settings · Share · Results** · a **Preview** (▶) action · **Publish** button + "Draft saved…" indicator (reuse the guide editor's save-state chip).
- **Left panel — Fields** — the ordered field list (drag-reorder), each row = type icon + title; a **Thank-you page** section below; a `+` add control. Selecting a field loads it into the center + right panel.
- **Center — live preview** — one-question-at-a-time rendering of the selected field (title, description, the input, button), styled by the current `design`.
- **Right panel — field settings** — type selector, Title, Description (rich-ish text), Required toggle, and type-specific config (options editor for choices, min/max, placeholder, `buttonText` for statement). A **Design** sub-panel (see below).

**Add-field palette (net-new, searchable)** — the existing `add-block-menu.tsx` is a static Popover row; field types are more numerous, so build a **searchable command palette** using the UI kit's `Command`/`CommandInput` (shadcn), matching the Youform "Search blocks…" UX (icon + name + description rows, `/ open · ↑↓ navigate · ↵ select · esc close`). Reuse the interleaved `+`-between-items + `EditableBlock` render pattern.

**Design panel** — clone `customize-guide-dialog.tsx`'s staging pattern: local `draft` copy → `onApply` into `applyEdit(doc => ({...doc, design}))`. Reuse its paired hex-`Input` + `<input type="color">` control for background/question/answer/button colors and the `Select`-over-font-enum. Sections: Colors, Font, Alignment, Progress bar.

**Settings tab** — accepting-submissions toggle, closed message, redirect URL, delete form.
**Share tab** — the public `/f/{shareId}` link + copy button + (later) embed snippet.

---

## 7. Public fill view — `apps/web/app/f/[shareId]/page.tsx`

Mirrors `app/g/[shareId]/page.tsx` (outside the `(app)` group, no navbar). Server component → `fetchPublicForm(shareId)` → `GET /api/public/forms/:shareId` (no auth, `status:"PUBLISHED"` + `deletedAt:null` gate; 404 otherwise). Fire-and-forget `viewCount++` on read (mirror `public/router.ts:66`).

**Renderer** (`components/public-form-view.tsx`) — **one question at a time** (Typeform/Youform style), reusing the `interactive-view` frame/index/keyboard pattern:
- `const [index, setIndex] = useState(0)`; Enter / button advances; per-field validation on advance; back/next; a progress bar (if `settings.showProgressBar`).
- First interaction fires a one-shot `POST /api/public/forms/:shareId/start` beacon (`startCount++`, deduped per `anonId` client-side).
- Final submit → `POST /api/public/forms/:shareId/submissions` (`submissionInputSchema`), server validates answers against published fields, creates `FormSubmission`, `submitCount++`, returns the thank-you (or redirects to `settings.redirectUrl`).
- Closed form (`!acceptingSubmissions`) → render `closedMessage`.
- Anonymous identity via the existing `useAnonId()` pattern (`localStorage tacto_anon_id`).

`shareId` minted with `nanoid(12)` on first publish, stable across re-publishes (mirror `guide/router.ts` publish).

---

## 8. Results — Submissions · Summary · Analytics

Form detail page **`/forms/[id]`** (inside `AppShell`): shows a **Form** preview tab + a **Results** tab with three sub-tabs. Navbar actions: **Edit** (`/forms/[id]/edit`), **Share**, **Publish/Update**, overflow (Settings, Delete). This matches the requested flow (card click → form page + Results; Edit → builder).

**Submissions** — paginated table (rows = submissions, columns = fields by title), a row-detail drawer, and **CSV export** (`GET /api/forms/:id/submissions/export`). Endpoint: `GET /api/forms/:id/submissions?cursor=&limit=`.

**Summary** — per-question aggregates computed server-side from submissions:
- choice fields → option counts + bars; `rating` → average + distribution; `number` → avg/min/max; text/email/phone → recent answers list + response count.

**Analytics** — `GET /api/forms/:id/analytics?range=all|30d|7d`:
- **Metric cards** — Views, Starts, Submissions, **Completion Rate** (`submissions/starts`), **Completion Time** (avg `durationMs`).
- **Trends** — **submissions over time** (grouped by day from `FormSubmission.createdAt`), rendered by a small internal **`<TrendChart>` SVG** area/line component (see §11). (Views-over-time + per-question drop-off are v2 — noted, not silently omitted.)

All results endpoints are `requireAuth` + `requireWorkspace` + `assertForm(id, workspaceId)`.

---

## 9. Library · sidebar · card · create · routing

**Sidebar** — the **Forms rail button already exists** as a placeholder (`rail.tsx:277`); wire its `active`/`onClick` to route to `/forms`. Reuse `AppShell`, `Rail`, `shell-bits` (`RailButton`/`ViewRow`/`FolderIndicators`) verbatim. For the library view state, add a **forms-scoped view provider** (clone `view-context.tsx` → `tacto:forms-view`, or generalize the existing provider with an entity key — clone is lower-risk). Reuse `FoldersPanel` (or a thin `FormsPanel` clone) showing **All forms / Pinned / Recent / Folders**, folders filtered to forms; gate Rename/Delete on `!folder.isDefault`.

**Library page** — `apps/web/app/(app)/forms/page.tsx`, cloned from `home/page.tsx`. The pure helpers in `lib/library.ts` (`filterGuides`/`applyFilterSort`/`computeCounts`) are generic over `{ pinnedAt, folderId, status, createdAt, updatedAt }`, which `Form` mirrors — reuse them (parameterized) rather than duplicating.

**Card** — clone `GuideCard` → `FormCard`: same shape + pin/move/delete/duplicate menu + confirm `Dialog`; chips become **responses · completion rate · status**. Cloned `FormCardSkeleton`.

**Create flow (net-new)** — a **"New form"** button (rail/library) opens a **name + description** `Dialog` (model on the workspace-create dialog, `rail.tsx:133`) → `POST /api/forms { title, description, folderId }` (defaults to `ensureDefaultFolder`) → seeds an empty `FormDraft` → `router.push('/forms/{id}/edit')`.

**Form API** (`apps/api/src/features/form/router.ts`, mounted `/api/forms`): `POST /` (create), `GET /` (list, workspace-scoped, ordered `pinnedAt desc nulls last, createdAt desc`), `GET /:id` (detail), `GET/POST/PATCH /:id/draft` (autosave), `POST /:id/publish`, `PATCH /:id` (rename/description/settings), `POST /:id/pin`, `POST /:id/move` (folder), `POST /:id/clone`, `DELETE /:id` (soft), plus results endpoints (§8). All gated by `requireAuth`+`requireWorkspace`+`assertForm`.

**Routes**
| Route | Purpose |
|---|---|
| `/forms` | library (shell) |
| `/forms/[id]` | detail: Form preview + Results tabs |
| `/forms/[id]/edit` | builder (chrome-free via `/edit`) |
| `/f/[shareId]` | public fill (no navbar) |

---

## 10. Embedding a form in a guide (overlay — after step / after N seconds)

**Critical UX constraint:** the embedded form is an **overlay** (modal / sheet) that pops **over** the guide when a trigger fires — it is **NOT** a step in the flow. The reader must never see `step 1 → form → step 2`. Therefore the embed is **NOT** a `presentationSlide`/sequence item (that would be placed inline by `buildInteractiveSequence`), and **NOT** a single rigid `guide.formEmbed` field.

Instead, embeds are a small, extensible **list of overlay triggers** stored as shared guide content, which **List and Interactive each render independently** (same data, view-specific trigger detection + rendering — GPT's "evolve independently," achieved without coupling to the step sequence).

- **Contract** — a dedicated `embeds` list, *sibling to* (not inside) `interactive`:
  ```ts
  export const formEmbedSchema = z.object({
    id: z.string().min(1),                    // stable embed id
    formId: z.string().min(1),                // the published form to show
    trigger: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("after-delay"), seconds: z.number().int().min(1).max(3600) }),
      z.object({ kind: z.literal("after-step"), stepKey: z.string().min(1) }),
    ]),
    style: z.enum(["modal", "sheet"]).default("modal"),   // overlay presentation
    dismissible: z.boolean().default(true),
    showOnce: z.boolean().default(true),      // don't re-show after dismiss/submit (per anonId)
  });
  export const guideEmbedsSchema = z.array(formEmbedSchema).max(5);
  export function readGuideEmbeds(raw): FormEmbed[] // default []
  ```
  Add `embeds: guideEmbedsSchema.default([])` to `draftDocumentV3Schema` (in-place, like `faqs` — no version bump) and a `Guide.embeds Json?` column. Publish writes it (extend `applyDraftContent`); private + public serialize expose it; dirty-check parity guaranteed (`readGuideEmbeds(null) === []` on both sides — same gotcha as FAQ, covered by a test).
- **Public serialize** — the public guide response resolves each embed's `formId` → includes the referenced form's **published document** (fields + design, only for `status:"PUBLISHED"` forms), so the reader can fill it inline without a second round-trip. Broken/unpublished references are dropped silently.
- **Guide editor** — an **"Embed a form"** panel (in the customize dialog / a toolbar item): add embed(s), pick a published form (workspace list), choose the trigger (after which step, or after N seconds/minutes), style, and show-once. Edits route through `applyEdit(doc => ({ ...doc, embeds }))`.
- **Rendering — both views, as an overlay (no sequencing change):**
  - **`after-delay`** → a timer started when the reader begins viewing; after `seconds`, open the overlay. (In Interactive, reuse the autoplay timer mechanic at `interactive-view.tsx:259` for the clock; it drives the overlay, **not** frame advancement.)
  - **`after-step`** → *List view*: `IntersectionObserver` on the anchored step → open when it scrolls into view. *Interactive view*: open when the current frame index reaches that step's frame.
  - The overlay is a `Dialog`/`Sheet` hosting `public-form-view` in a compact inline mode; `dismissible` + `showOnce` tracked per `anonId` (localStorage) so it never nags.
  - `buildInteractiveSequence` is **untouched** — embeds are orthogonal to the step sequence.
- **Submissions** carry `metadata.guideId` for provenance; the overlay submits to the same public form endpoint.

Multiple embeds per guide are supported from day one (the `embeds` array), e.g. a delay-triggered survey plus a step-triggered CTA.

---

## 11. Charting (no dependency)

No charting lib is installed and we avoid heavy deps. Build a small internal **`components/trend-chart.tsx`** — an SVG area/line chart for the daily submissions series (path + gradient fill + hover tooltip + axis ticks), theme-aware, ~120 lines. Same self-contained, on-brand approach as the video-export SVG work. (If richer analytics later demand it, revisit adding `recharts`.)

---

## 12. Security, limits, integrity

- **Workspace scoping** — every authed form route goes through `assertForm(id, workspaceId)` (mirror `assertGuide`). Public routes gate on `status:"PUBLISHED"` + `deletedAt:null`.
- **Submission validation** — server-authoritative against published fields (`validateSubmission`), independent of client. Reject on closed form / unknown fields / missing required / bad option / length/min-max.
- **Spam / abuse** — rate-limit `POST /submissions` per IP+shareId (and per `anonId`); optional honeypot field; cap answer payload size. (Reuse/introduce a lightweight limiter; note if none exists.)
- **Counters** — `viewCount`/`startCount`/`submitCount` incremented fire-and-forget (never block responses), mirroring the guide `viewCount` pattern.
- **Deletion** — soft delete (`deletedAt`); submissions cascade on hard delete only. Deleting a folder reassigns its forms to General (extend the folder delete transaction).
- **PII** — submission answers may contain PII; keep them workspace-scoped, never in public reads, and out of logs.

---

## 13. Rollout (phased; each phase compiles + lints + tests + ships)

1. **Contracts + DB** — `form.ts` schemas, `Form`/`FormDraft`/`FormSubmission` models, `Folder.forms`, migration. Invisible.
2. **Form CRUD + draft/publish API** — create/list/detail/draft(save)/publish/rename/pin/move/clone/delete + `buildFormDraft` + dirty check + `assertForm`. Tests: draft optimistic-concurrency, publish round-trip, dirty-check parity, default-folder placement.
3. **Library + sidebar + card + create** — `/forms` page, forms view provider, `FormsPanel`, `FormCard`, New-form dialog, wire the rail button. Reuse `lib/library.ts` helpers.
4. **Builder** — `/forms/[id]/edit`: editor scaffolding (history/autosave/cache), field list + searchable palette + `EditableField`, right settings, Design panel, Build/Settings/Share tabs, Preview.
5. **Public fill + submissions** — `/f/[shareId]`, `public-form-view` (one-at-a-time), submit/start endpoints, view/start/submit counters, thank-you/redirect, closed-state. Tests: submission validation, counters.
6. **Results** — `/forms/[id]` detail + Submissions/Summary/Analytics, analytics/summary/submissions endpoints, `<TrendChart>`, CSV export.
7. **Guide embedding (overlay)** — `formEmbedSchema` + `guide.embeds[]` (draft doc + `Guide.embeds` column + serialize + dirty-check), guide-editor embed panel, **overlay** rendering in both views (delay timer + step IntersectionObserver/frame-index), show-once per anonId, submission provenance. Never a sequence item.

Each phase: `npx turbo typecheck lint build` + `npm test -w api` + `npm test -w worker`, and verify no guide regressions. **STOP + explain** on any architectural conflict.

---

## 14. Testing

- **Contracts** — `formDocumentV1Schema` parse/migrate; `validateSubmission` (required/type/options/limits); `formDraftPatchSchema`.
- **API** — draft 409 optimistic-concurrency; publish round-trip (`Form.document`, `shareId` stable, `status`); dirty-check parity (empty form not dirty after seed); submission accept/reject; counters; workspace isolation (`assertForm` 404 cross-workspace); default-folder placement + folder-delete reassignment.
- **Web** — pure library helpers over `Form`; builder autosave/undo (reuse guide editor test patterns if present).
- **Fill** — submit happy-path + validation failures; closed form.

---

## 15. Open questions / decisions to confirm

1. **Fill layout** — v1 = **one-question-at-a-time** (matches Youform inspo + reuses walkthrough player). Confirm vs a simpler classic single-page (faster to ship, less polished).
2. **Publish model** — **single** `POST /publish` (content + visibility together). Confirm vs mirroring guides' two-step (`publish-draft` + `publish`).
3. **Folders shared with guides** — a folder can hold both guides and forms (default General shared). Confirm vs a separate forms-only folder namespace.
4. **Analytics v1 depth** — scalar Views/Starts/Submissions + **submissions**-over-time trend + per-question summary; **drop-off** + **views-over-time** deferred to v2. Confirm.
5. **Results placement** — Results as tabs on `/forms/[id]` (Form preview + Results). Confirm vs a dedicated `/forms/[id]/results` route.
6. **Charting** — hand-rolled SVG `<TrendChart>` vs adding `recharts`. Confirm the no-dep approach.
7. **Embeds** — form embeds are **overlays** (modal/sheet) triggered by delay or step, stored as an extensible `guide.embeds[]` list (NOT sequence slides, NOT a single field). Multiple per guide supported. Confirm overlay-only (never inline).

---

## Appendix — reused infrastructure (file:line anchors)

| Concern | Reuse from |
|---|---|
| Draft optimistic save / 409 | `apps/api/src/features/guide/router.ts:262` (`handleDraftSave`) |
| Publish transaction / reconcile | `apps/api/src/features/guide/publish-draft.ts` (`publishDraft`/`applyDraftContent`) |
| Editor history / autosave / cache | `apps/web/app/(app)/guides/[id]/edit/page.tsx` (`applyEdit` L526, `flush` L309), `lib/editor-history.ts`, `lib/draft-cache.ts` |
| Draft hooks | `apps/web/lib/guides.ts:195` (`useGuideDraft`/`useSaveDraft`/`usePublishDraft`) |
| Public read + feedback | `apps/api/src/features/public/router.ts` (view-count L66, reactions L136) |
| Public page + fetch | `apps/web/app/g/[shareId]/page.tsx`, `lib/public-guide.ts` |
| Submissions analog | `guide-feedback.tsx` (`useAnonId`, optimistic POST) |
| Player (frame/index/autoplay) | `apps/web/components/interactive-view.tsx` (frames L75, autoplay L259) |
| Presentation anchoring | `packages/contracts/src/guide.ts` (`slideAnchorSchema` L389, `buildInteractiveSequence` L448) |
| Design/customization panel | `apps/web/components/customize-guide-dialog.tsx` (color control L420, staging L189) |
| Shell / rail / folders / card | `app-shell.tsx`, `rail.tsx:277` (Forms button), `folders-panel.tsx`, `shell-bits.tsx`, `guide-card.tsx:267`, `lib/library.ts`, `lib/folders.ts` |
| Default folder | `packages/db/src/index.ts:43` (`ensureDefaultFolder`), `folder/router.ts:137` (delete guard) |
| shareId mint | `apps/api/src/features/guide/router.ts:488` (`nanoid(12)`) |
