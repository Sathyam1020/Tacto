# Tacto — Phase 5: Guide viewer modes, editor, and publishing

## Context

The pipeline produces guides but they're read-only and private. This phase finishes the **create → refine → publish → share** loop end-to-end so Tacto is actually usable: a rich guide viewer (list + interactive), a Guidejar-style block editor to fix AI drafts, and public shareable links. Walkthrough *editing* (hotspots/overlays) is explicitly deferred; walkthrough *viewing* (a step slideshow) is in scope.

Reference behavior (from founder's Guidejar screenshots):
- Guide navbar cluster: **List / Interactive** view toggle · Analytics · Info · **Edit** · **Share/Publish**
- Edit navbar: **Back** + **Save** only; Back with unsaved changes → confirm modal
- Editor: click any text → inline rich-text editor (H1/Bold/Italic/Strike/List/Link; Save ⌘↵ / Cancel). `+` between every block → menu: **Step · Heading · Tip · Alert**. Per-step: **add media · delete**.
- Published link → anyone (no login) views the guide in the selected mode.

Versions verified: TipTap 3.27 (`@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-link`), `sanitize-html` 2.17, `nanoid` 5.1.

## Key architecture decisions (flagged)

- **Blocks, not just steps.** A guide becomes an ordered list of typed blocks: `STEP | HEADING | TIP | ALERT`. Reuse the existing `Step` table — add a `type` enum + rename `instruction`→`content` (now sanitized **HTML**). Display numbering counts only `STEP` blocks. Additive, minimal migration (test data only).
- **Rich text = sanitized HTML.** TipTap edits → `getHTML()` → API sanitizes on save (`sanitize-html` allowlist: p, strong, em, s, u, h1, h2, ul, ol, li, a[href], br) → stored HTML rendered with `dangerouslySetInnerHTML` (already safe). Public pages re-sanitize on read (defense in depth). Existing `**bold**` markdown converted to HTML in the migration.
- **Contextual navbar via a slot.** New `NavbarContext` in the `(app)` layout; pages inject `{title, actions}` on mount, clear on unmount. Default = Capture button; guide view = the cluster; edit = Back+Save. Keeps Save/Back wired to the edit page's live state.
- **Save = one transactional bulk write.** `PUT /api/guides/:id` accepts `{title, summary, blocks[]}` and replaces blocks in a transaction (handles add/edit/delete/reorder at once). Blocks round-trip `screenshotKey` (raw R2 key); responses also include presigned `screenshotUrl` for display.
- **Publishing = unlisted link.** `Guide.shareId` (nanoid, unique), `publishedAt`, `viewCount`. Public API `GET /api/public/guides/:shareId` (no auth, PUBLISHED only, presigned screenshots, increments views). Public web route `app/g/[shareId]` — **outside `(app)`**, no sidebar, SSR + OG meta for link previews, with the same List/Interactive toggle.
- **Edit mode is focused** — its own route `app/(app)/guides/[id]/edit`; the `(app)` layout hides the sidebar when the path ends in `/edit` (navbar already contextual). Matches Guidejar's full-focus editor.

## What gets built

### 1. Schema (`packages/db`) — migration `guide-blocks-publishing`
- `enum BlockType { STEP HEADING TIP ALERT }`
- `Step`: `+ type BlockType @default(STEP)`, rename `instruction → content`, keep media fields (STEP-only)
- `Guide`: `+ shareId String? @unique`, `publishedAt DateTime?`, `viewCount Int @default(0)`
- Migration SQL hand-verified to convert existing `instruction` `**x**` → `<p>…<strong>x</strong></p>`

### 2. Contracts (`packages/contracts/src/guide.ts`, new)
- `blockTypeSchema`, `guideBlockSchema` (id?, type, content, screenshotKey?, elementLabel?, url?), `updateGuideSchema` ({title, summary, blocks[]}), `publicGuideSchema`. Synthesis output in `capture.ts` maps into STEP blocks.

### 3. API (`apps/api`)
- `features/guide/router.ts`: extend GET (return `type`, `content`, `screenshotKey`+presigned `screenshotUrl`, `shareId`, `publishedAt`, `viewCount`); `PUT /api/guides/:id` (sanitize + transactional block replace); `POST /api/guides/:id/publish` / `unpublish`; `GET /api/guides/:id/analytics`.
- `features/media/router.ts` (new): `POST /api/media/upload-url` → presigned PUT + key (`media/<org>/<guideId>/<nanoid>.<ext>`), reuses `@workspace/storage`.
- `features/public/router.ts` (new, mounted WITHOUT requireAuth): `GET /api/public/guides/:shareId` → published guide + blocks + presigned screenshots, `viewCount++`.
- `packages/ai` synth + worker `assemble`: write STEP blocks (`type: STEP`, `content` HTML).

### 4. Web — shared UI (`packages/ui` / `apps/web/components`)
- `rich-text-editor.tsx` (TipTap, the inline editor: toolbar H1/B/I/S/list/link, Save/Cancel, ⌘↵) + `rich-text.tsx` (read-only sanitized render).
- `block-view.tsx` — renders a block by type: STEP (number + content + screenshot + url + review badge), HEADING (large serif), TIP (viridian-tinted box + info icon), ALERT (amber-tinted box + icon). Shared by private view, editor preview, public page.
- `interactive-view.tsx` — step slideshow (one block at a time, screenshot + content, next/prev, progress, arrow keys, Esc). Steps only.
- `view-mode-toggle.tsx`, navbar cluster pieces (analytics/info/edit/share buttons), `share-dialog.tsx` (publish toggle → copyable `/(g)/shareId` link, unpublish), `add-block-menu.tsx` (the `+` popover: Step/Heading/Tip/Alert), `NavbarContext`/`useNavbar`.

### 5. Web — pages (`apps/web`)
- `(app)/guides/[id]/page.tsx`: viewer with List/Interactive toggle; injects navbar cluster; Analytics + Info dialogs; Share dialog. Title editable-in-place stays for the edit page.
- `(app)/guides/[id]/edit/page.tsx` (new): the block editor — inline rich-text on every block, `+` add-block between/around blocks, per-step add-media (upload → R2 → set screenshotKey) + delete, reorder later. Local dirty state; navbar Save (bulk PUT) + Back (confirm modal if dirty).
- `app/g/[shareId]/page.tsx` (new, public, no app shell): SSR fetch, `generateMetadata` OG tags, List/Interactive toggle, Tacto footer.
- `(app)/layout.tsx`: wrap in `NavbarProvider`; hide sidebar on `*/edit`.
- `lib/guides.ts`: block types, `useUpdateGuide`, `usePublishGuide`, media-upload helper; `AppNavbar` renders injected actions.

### 6. Deps + docs
`apps/web` += tiptap trio; `apps/api` += sanitize-html, nanoid. Plan → `docs/plans/phase-05-editor-publishing.md`.

## Deliberately deferred (this phase)
Walkthrough/interactive **editing** (hotspots), voiceovers, translations, import/export/sort-steps, drag-reorder of blocks (add/delete/edit only for now), deep analytics (view count only), custom-domain publishing, per-step audio.

## Order of implementation
1. docs + schema migration + contracts
2. api (guide PUT/publish, media, public) + worker assemble → blocks
3. shared UI (rich text, block-view, interactive-view, navbar slot)
4. guide viewer page (toggle + cluster + share/analytics/info)
5. edit page (inline editing, add-block, media, save/back)
6. public page + OG
7. verify E2E

## Verification (end-to-end)
1. Open the existing API-keys guide → navbar shows cluster; toggle List ↔ Interactive (slideshow, arrow keys) works
2. Edit → navbar becomes Back+Save, sidebar hidden; click a step's text → rich editor, bold a word, Save; add a Tip and a Heading via `+`; add-media uploads an image to a step; delete a step; Back while dirty → confirm modal
3. Save → reload → all edits persisted (types, HTML, media)
4. Share → Publish → open the `/g/:shareId` link in a logged-out browser → renders published guide; toggle interactive; viewCount increments; Analytics shows it
5. Unpublish → public link 404s
6. Cross-workspace: other account can't PUT/GET/publish this guide (404); public link still works
7. `turbo typecheck && lint && build` green; sanitize check: a `<script>` in content is stripped on save
