# RFC: Editor Draft → Publish Architecture

Status: **Proposed** · Owner: eng · Scope: apps/web (editor), apps/api, packages/db, packages/contracts

> Goal: editing a guide must never mutate the published guide, must never lose
> work, and must resume seamlessly across sessions/devices — while keeping the
> architecture maintainable and incrementally shippable. Publishing is the only
> action that changes what the public sees.

---

## 0. Context — where we are today

- A **`Guide`** row is simultaneously "the thing the public sees" and "the thing
  you edit." Public reads `GET /api/public/guides/:shareId` → the same `Guide` +
  its normalized `Step` (block) rows.
- **Saving edits mutates published content directly**: `PUT /api/guides/:id`
  runs a transaction that `deleteMany` + `createMany` on `Step` (so block IDs
  churn on every save), updates `Guide.title/summary`, and publishes
  translations. Customization is a separate `PATCH`.
- There is **no draft**. "Leaving" offers only *Keep editing / Discard*.
- Consequences we've already hit: customization/translations leaking to public
  before an explicit save; translations breaking because block IDs are not
  stable across a save (worked around with position-index keying).

The redesign fixes the root cause: **separate the mutable working draft from the
immutable published snapshot.**

```
Published Guide (immutable during editing)
        │  seed
        ▼
   Private Draft  ←── autosave (server-side source of truth)
        │  Publish (explicit, validated, transactional)
        ▼
Published Guide (new snapshot)
```

---

## 1. Architecture

Three representations, clear ownership:

| Representation | Store | Written by | Read by |
|---|---|---|---|
| **Published guide** | normalized `Guide` + `Step` + `GuideTranslation(published=true)` | **Publish only** | public reader, in-app viewer, PDF, list cards |
| **Draft** | `GuideDraft` row (one JSON document + version) | autosave (debounced) | the editor only |
| **Session edit state** | client memory (undo/redo history) | user edits | the editor UI |

Principles:

- **Editing never touches published rows.** The editor reads/writes `GuideDraft`
  exclusively. Publish is the single code path that promotes a draft into the
  normalized published tables.
- **Server draft is the source of truth.** `localStorage` is only a
  low-latency cache/offline buffer (per the multi-device/crash requirements).
- **Undo/redo is session-only**, lives in the client, and operates on the draft
  document — never on published data.
- **Draft persistence ≠ publishing.** Persistence is automatic and silent;
  publishing is explicit and never automatic.

Why a **separate `GuideDraft` table** rather than a `Guide.draft` JSON column or
a full `GuideVersion` system (detailed trade-offs in §2):
- Draft writes are frequent (autosave) — isolating them off the hot `Guide` row
  (which the public reads) avoids write contention and row bloat.
- Gives a natural home for draft metadata: `version`, `updatedByUserId`,
  `updatedAt`, `baseVersion` for conflict detection.
- Non-breaking path to a future `GuideVersion`/history/approvals/branching model
  without moving normalized blocks now (which would be a very large migration
  touching public serialization, PDF, translations, reactions/comments).

---

## 2. Data model

### 2.1 The draft document (JSON, versioned)

A draft is a single self-contained document — denormalized on purpose (it's a
work-in-progress, never queried into):

```
DraftDocumentV1 {
  v: 1                       // document schema version (forward-compat)
  title: string
  summary: string | null
  blocks: DraftBlock[]
  customization: GuideCustomization
}

DraftBlock {
  key: string               // STABLE client-generated uuid — the block's identity
  type: "STEP" | "HEADING" | "TIP" | "ALERT" | "OUTCOME"
  content: string           // sanitized-on-publish HTML
  screenshotKey: string | null   // R2 object key (already uploaded)
  elementLabel: string | null
  url: string | null
  clickRect: { x,y,w,h } | null
}
```

**Key decision — stable block identity (`key`).** Today `Step` IDs churn on
every save, which breaks anything that references a block (translations today;
per-step voiceovers, step comments, review threads tomorrow). We introduce a
stable `key` that lives in the draft and is carried onto the published `Step`.
This is the proper fix for the translation-keying hack and unblocks future
per-step features.

### 2.2 Prisma model

```prisma
model GuideDraft {
  id             String   @id @default(uuid())
  guideId        String   @unique
  guide          Guide    @relation(fields: [guideId], references: [id], onDelete: Cascade)
  document       Json                    // DraftDocumentV1
  version        Int      @default(1)    // optimistic-concurrency counter
  updatedByUserId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@map("guide_draft")
}

// Add to Step:
//   key String  // stable block identity, carried across publishes
//   @@unique([guideId, key])
```

- `Guide` keeps `status` (DRAFT|PUBLISHED), `shareId`, `publishedAt`,
  `customization`, `summary`, `title`. Semantics tighten: these columns are the
  **published** snapshot; the draft never writes them until Publish.
- `GuideTranslation.published` (already added) keeps its meaning: translations
  publish on Publish.

### 2.3 Considered alternatives (and why not, now)

- **`Guide.draft Json?` column** — simplest, but couples frequent draft writes to
  the public-read hot row, bloats the row, and has nowhere clean for draft
  metadata. Viable fallback if we want the smallest possible change.
- **Full `GuideVersion` model** (immutable versions; draft = mutable head) — the
  most future-proof for history/approvals/branching, but requires moving blocks
  into versions: a very large migration rippling through public serialization,
  PDF, translations, reactions/comments. **Deferred.** `GuideDraft` + `Step.key`
  + a versioned publish is a strict subset that lets us add `GuideVersion` later
  by having Publish *also* write an immutable snapshot — no rework.

**Principal-engineer take:** at Tacto's stage, `GuideDraft` is the correct
amount of architecture. Building versioning/branching/collaboration now is
speculative and would slow shipping; the recommended model keeps every one of
those doors open (stable keys, versioned drafts, transactional publish) without
paying for them today.

---

## 3. Draft lifecycle

1. **Open editor** → `GET /api/guides/:id/draft`.
   - If a draft exists → return `{ document, version }`.
   - If not → server creates one seeded from the **published** guide (title,
     summary, blocks→DraftBlocks with fresh `key`s or their existing `Step.key`,
     customization) and returns it. Seeding is idempotent (create-if-absent).
   - Client hydrates instantly from `localStorage` first (if present & same
     guide), then reconciles with the server draft (server version wins).
2. **Edit** → each change updates the client `present` doc and pushes history.
3. **Autosave** (see §6) → debounced `PATCH /api/guides/:id/draft` with
   `{ document, baseVersion }`. Server: if `baseVersion === draft.version`,
   write + `version++`, return new `{ version, updatedAt }`. Else `409 Conflict`
   (see §6/§7).
4. **Leave** → dialog (§9). Draft already persisted server-side; *Leave & keep
   draft* just navigates; *Discard draft* → `DELETE /api/guides/:id/draft`.
5. **Publish** → §4. On success the draft is deleted and the editor reseeds from
   the new published snapshot (or navigates to the viewer).

Draft is created lazily (first open of the editor). Existing guides get no draft
until edited — zero backfill risk.

---

## 4. Publishing lifecycle

`POST /api/guides/:id/publish` (evolves the current publish endpoint):

1. **Load** the draft (404 if none → nothing to publish).
2. **Validate** (`packages/contracts`): title non-empty & ≤200; ≤500 blocks;
   each block type valid; content length caps; `screenshotKey`s belong to this
   workspace/guide; customization schema-valid. Reject with field errors.
3. **Transaction** (single Prisma `$transaction`):
   - Update `Guide` (title, summary, customization, `status=PUBLISHED`,
     `publishedAt=now`, ensure `shareId`).
   - Reconcile `Step` rows **by `key`**: upsert present blocks (preserving
     identity), delete blocks whose `key` is gone. (Upsert-by-key instead of
     delete+recreate → identity stable → translations/voiceovers survive.)
   - Re-sanitize block content server-side.
   - Publish translations (`GuideTranslation.published=true`), and (optional,
     future) write a `GuideVersion` snapshot.
   - Delete the `GuideDraft` row (or mark `appliedAt`; delete is simplest).
4. **Return** the fresh published guide; client refreshes editor/viewer state.

**Failure cases**
- Validation fails → no writes; editor shows errors; draft intact.
- DB/tx fails → transaction rolls back atomically; draft intact; user retries.
- **Concurrent publish** → guarded by the draft `version`: the publish reads a
  `baseVersion`; the tx `delete`s the draft `where version = baseVersion`; if 0
  rows deleted, another publish won already → return the current published guide
  (idempotent no-op) rather than double-applying.
- Network drop mid-publish → client can't confirm; on retry, publish is
  effectively idempotent (draft already gone → returns published state).

---

## 5. Undo architecture

- Client `useReducer` over `{ past: Doc[], present: Doc, future: Doc[] }`.
- Every edit → `commit(nextDoc)`: `past.push(present)`, `present = next`,
  `future = []`.
- **Undo**: `present → future`, `past.pop() → present`. **Redo**: inverse.
- **Coalescing**: title/summary keystrokes and other rapid text edits collapse
  into one history entry via a trailing debounce (~500–700ms) or a "same-field
  contiguous edit" merge rule. Structural ops (add/delete/reorder/import/
  customization change) are discrete entries.
- **Edit counter** = `past.length` (position in history; decrements on undo).
- History is **session-only**. After reload, the restored draft is the new
  `present` with empty history (per requirement). Undo does not reach across a
  publish (publish can reset history or keep it — recommend reset for clarity).
- History lives on the same `Doc` shape autosave persists, so undo/redo simply
  changes `present` and the existing autosave path syncs it.

---

## 6. Sync strategy

- **Debounced autosave**: coalesce edits; flush ~800ms–1.5s after edits go idle.
  Also **flush eagerly** on: input blur, route change (Next `router` events),
  `visibilitychange → hidden`, and `beforeunload`/`pagehide` via
  `navigator.sendBeacon` (fire-and-forget, survives tab close).
- **Optimistic-concurrency**: every `PATCH` carries `baseVersion`; server bumps
  `version`. Client stores the returned `version`. Mismatch → `409`.
- **localStorage cache**: on open, hydrate from `localStorage[draft:<guideId>]`
  for instant resume, then fetch the server draft and reconcile (server wins if
  its `version` is newer; otherwise flush the local unsynced doc). On each
  successful autosave, mirror `{ document, version }` to localStorage. On
  offline, keep writing localStorage and queue the sync.
- **Payload size**: send the full `DraftDocumentV1` JSON (blocks reference R2
  keys, so the doc stays small — typically << 1MB). Rely on HTTP gzip. Only if
  guides grow huge do we move to op/patch-based sync (JSON Patch) — explicitly
  out of scope now, noted as the escape hatch.
- **Rerender hygiene**: keep `present` in a reducer; memoize block components by
  `key`; autosave reads via a ref so typing doesn't thrash the network layer.

---

## 7. Failure handling

| Failure | Behavior |
|---|---|
| Debounced save in flight, user edits again | latest wins; coalesced; single trailing request |
| `409 Conflict` (edited elsewhere) | pause autosave; banner "Edited on another device"; offer **Reload draft** (take server, discard local) or **Overwrite** (force with server's current version) |
| Offline | navbar "Offline — saving locally"; localStorage keeps state; queue flush on reconnect (then version-check → maybe conflict) |
| Tab closed mid-edit | `pagehide` + `sendBeacon` flush; worst case last ~1s of edits lost, recovered from localStorage on return |
| Publish fails (validation) | inline field errors; draft intact |
| Publish fails (network/DB) | atomic rollback; retry; idempotent |
| Simultaneous publish (2 devices) | version-guarded delete → second is a no-op returning published state |
| Guide deleted while editing | API 404 → "This guide was deleted"; offer to export the local draft (JSON download) as a courtesy |
| Org membership removed | API 403 → "You no longer have access"; local draft retained read-only |
| Large guide | soft doc-size cap (e.g. 2MB) with a friendly error; screenshots are keys so this is rare |
| Unsaved uploaded screenshots | already in R2 (key in draft); re-presigned on restore via `POST /media/sign`; orphans (uploaded, never published) reclaimed by a future reaper |

---

## 8. Edge cases (checklist)

- Browser crash / refresh → resume from server draft (localStorage bridges the
  last second).
- Same guide open in two tabs → both hydrate same draft; version conflicts
  serialize via 409; last-writer-wins with warning.
- Publish then immediately edit → new draft seeded from the just-published guide.
- Discard draft then reopen → editor seeds a fresh draft from published.
- Draft exists but published guide changed by an admin path → conflict surfaced
  by `baseVersion` mismatch on next publish (draft base ≠ current published).
- Screenshot uploaded, draft never published → orphan key in R2 (reaper).
- Reverting all edits (undo to start) → draft equals published; publish is a
  no-op (still allowed; cheap).
- Very old draft (schema `v` bumped) → migrate-on-read in the API using the
  document `v` field.

---

## 9. UI flow

**Editor navbar** (replaces the auto-save toggle with *state*, per requirement):

```
← Back    [Draft saved · 5s ago]        ↶ Undo  ↷ Redo   Discard draft   Publish
```

- **Draft status** (live): `Saving…` → `Draft saved` → `Draft saved 5s ago` →
  `Offline` → `Conflict` (with resolve action). Never a toggle; it just happens.
- **Undo / Redo** curved-arrow icon buttons, disabled at the ends; an optional
  "N edits" affordance can sit by the status.
- **Discard draft** → confirmation, then `DELETE` draft + reseed from published.
- **Publish** primary button (was "Save").

**Leave dialog** (when a draft has unsynced or any changes):
- Title: **Leave editor?**
- Body: *Your changes are saved as a private draft. They won't be visible until
  you publish.*
- Actions: **Continue editing** · **Leave & keep draft** · **Discard draft**
  (Discard deletes the draft entirely).

**Elsewhere**
- In-app viewer (`guides/[id]`) shows the **published** guide; if a draft exists,
  show an "Edits in progress" chip linking to the editor.
- Guides list card can show a small "Draft" badge when a draft exists.
- Public reader unchanged (reads published only).

---

## 10. Database changes

1. `GuideDraft` table (§2.2), `@@unique(guideId)`, `onDelete: Cascade`.
2. `Step.key String` + `@@unique([guideId, key])`; backfill existing rows with
   generated uuids in the migration.
3. (Later, optional) `GuideVersion` table for history/approvals — not in this
   RFC's build scope.

All additive; no destructive changes to existing published data.

---

## 11. API changes

New / changed (all workspace-scoped, `requireAuth` + `requireWorkspace`):

- `GET  /api/guides/:id/draft` — get-or-create draft (seed from published).
- `PATCH /api/guides/:id/draft` — autosave `{ document, baseVersion }` → `{ version, updatedAt }` or `409`.
- `DELETE /api/guides/:id/draft` — discard.
- `POST /api/guides/:id/publish` — evolve to apply-draft→published (validate, tx, delete draft, version-guarded).
- `POST /api/media/sign` — presign a list of R2 keys (scoped) for draft restore.
- **Deprecate/remove** `PUT /api/guides/:id` (the live bulk-block replace) and
  the standalone customization `PATCH` as *editor* write paths — editing now
  writes only the draft; publish is the only path to published content.
- The Import/Sort/Customize/Translate dialogs keep working but now mutate the
  **draft document** in the client (translations remain a special server-side
  artifact keyed by stable block `key`, published on Publish).

Contracts (`packages/contracts`): `draftDocumentSchema` (v1), `draftPatchSchema`,
publish validation schema, `signKeysSchema`.

---

## 12. Migration strategy

Incremental, each phase shippable and testable:

- **Phase 0 — schema**: add `GuideDraft`, `Step.key` (+ backfill). No behavior
  change. Ship.
- **Phase 1 — draft read/write**: editor loads from `GET draft` (seed on first
  open), autosaves via `PATCH draft`; undo/redo + navbar draft-status; leave
  dialog. Publish still uses the *old* path temporarily (writes published). This
  already delivers "never lose work" + "resume."
- **Phase 2 — publish rewrite**: `POST publish` applies draft→published by `key`
  (upsert), publishes translations, deletes draft; remove the live `PUT`/`PATCH`
  editor writes. This delivers "immutable published while editing."
- **Phase 3 — resilience**: localStorage cache, offline queue, `sendBeacon`
  flush, conflict UI, `/media/sign` rehydrate.
- **Phase 4 (optional/future)**: `GuideVersion` snapshots, history UI, approvals.

Backward-compatible throughout: existing guides simply gain a draft on first
edit; published data is untouched until an explicit publish.

---

## 13. Testing strategy

- **Unit**: history reducer (undo/redo/coalescing/counter); document
  migrate-on-read; conflict/version logic; publish validation.
- **Integration (api)**: draft get-or-create idempotency; PATCH concurrency
  (baseVersion mismatch → 409); publish transaction success + rollback on
  injected failure; version-guarded concurrent publish; `/media/sign` scoping.
- **E2E (web)**: edit→reload→resume; leave→keep→resume; discard→reseed;
  offline→edit→reconnect→sync; two-tab conflict; publish→public updates,
  pre-publish→public unchanged.
- **Load**: autosave cadence under rapid typing (debounce holds); large-doc
  PATCH latency; ensure no per-keystroke network.

---

## 14. Risks

- **Scope/time**: this is multi-week. Mitigated by the phased plan (Phase 1
  alone delivers most user value).
- **Block-identity migration**: introducing `Step.key` and upsert-by-key changes
  the save path; must keep translations/PDF/public serialization correct.
- **Autosave cost / rerenders**: bad debouncing or unmemoized blocks could
  thrash; mitigated by reducer + refs + `key`-memoized blocks.
- **Conflict UX**: multi-device conflict is inherently confusing; keep it minimal
  (reload/overwrite) and well-copy'd.
- **Two sources of truth (server + localStorage)**: reconciliation bugs; keep the
  rule strict — server version wins; localStorage is cache only.
- **Over-engineering**: resist building versioning/collab now; the seams are
  enough.

---

## 15. Final recommendation

Adopt a **server-side `GuideDraft`** (single versioned JSON document) as the
draft source of truth, with **`localStorage` as an optimistic cache**, a
**client-side past/present/future undo reducer** (session-only, coalesced), and
an **explicit, validated, transactional Publish** that applies the draft to the
normalized published tables and is the *only* mutation of public content. Add a
**stable `Step.key`** to make block identity survive publishes (fixing
translations properly and unblocking per-step features). Redesign the navbar
around **draft status + undo/redo + Discard + Publish**, and the leave dialog
around **Continue / Leave & keep / Discard**.

**Explicitly defer** `GuideVersion`, history, approvals, branching, and real-time
collaboration — the recommended model reaches all of them later without rework.

Build in the four phases of §12; **Phase 1 delivers "never lose work" and
"seamless resume" on its own**, so we get the biggest user win early while the
publish rewrite (Phase 2) lands the immutability guarantee.

### Open decisions for approval
1. **Draft store**: separate `GuideDraft` table (recommended) vs `Guide.draft`
   JSON column (lighter). → recommend table.
2. **Block identity**: introduce `Step.key` now (recommended, unblocks
   translations/voiceovers) vs keep index-keying. → recommend `Step.key`.
3. **Conflict policy**: last-writer-wins + 409 warning (recommended minimal) vs
   soft-lock/presence. → recommend LWW+409.
4. **GuideVersion**: defer (recommended) vs build now. → recommend defer.
5. **Phasing**: ship Phase 1 (drafts/undo/resume) before Phase 2 (publish
   rewrite)? → recommend yes.
