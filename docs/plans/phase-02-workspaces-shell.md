# Tacto — Phase 2: Workspaces + App Shell (floating sidebar & navbar)

## Context

Auth (Phase 1) shipped. Before the data-model/pipeline work, the founder wants the product to *feel* like a product: a production-grade app shell — floating sidebar + floating navbar (reference: Guidejar's app + a floating-card sidebar screenshot; ours must be better and on-brand) — and real **multi-workspace** support: one user, many workspaces, everything scoped to the active workspace.

Two research findings shape the whole phase:
- **better-auth organization plugin** provides workspaces natively: `Organization`/`Member`/`Invitation` models, `activeOrganizationId` on the session, client hooks (`useListOrganizations`, `useActiveOrganization`, `organization.create/setActive/checkSlug`), roles (owner/admin/member). We use it instead of hand-rolling — "Organization" in code, **"Workspace" in all UI copy**.
- **shadcn sidebar component** provides the shell: `variant="floating"`, `collapsible="icon"`, ⌘B toggle, mobile sheet, cookie-persisted state. Our `globals.css` already defines every `--sidebar-*` token from the design-system phase.

Deliberate scope calls (flagged, not asked): active workspace lives **in the session** (org-plugin native), not in the URL — URL-scoping (`/w/slug/…`) can come later, pre-launch there are no bookmarks to break. **Invitations UI is OUT** (needs email infra — Resend lands with a later phase); the tables exist via the plugin so nothing is wasted.

## What gets built

### 1. Backend — org plugin + schema (`apps/api`, `packages/db`)
- `apps/api/src/lib/auth.ts`: add `organization()` plugin; add `databaseHooks`:
  - `user.create.after` → create personal workspace (`"<first-name>'s Workspace"`, generated unique slug) + owner membership (direct prisma writes)
  - `session.create.before` → set `activeOrganizationId` to the user's first membership (so nobody lands workspace-less)
- `packages/db/prisma/schema.prisma`: add `Organization`, `Member`, `Invitation` models + `Session.activeOrganizationId` per plugin spec (cross-check with `npx @better-auth/cli generate`); migration `add-organizations`
- `apps/api/src/middleware/require-workspace.ts`: after `requireAuth` — reads `session.activeOrganizationId`, verifies membership, attaches `req.workspace` + `req.membership`; 400 if no active workspace
- Exemplar endpoint `GET /api/workspace/current` (feature: `src/features/workspace/`) returning active workspace + role — proves the middleware pattern for every future feature
- `packages/contracts/src/workspace.ts`: `createWorkspaceSchema` (name 1–50), `renameWorkspaceSchema`, workspace/member output shapes

### 2. Web — auth client plugin + shell (`apps/web`)
- `lib/auth-client.ts`: add `organizationClient()` plugin
- Add shadcn `sidebar` component (+ its deps: sheet, collapsible — rest already present) into `packages/ui`
- **New route group `app/(app)/`** with `layout.tsx`:
  - client session guard (redirect to /sign-in) — moves out of library page
  - `SidebarProvider` + `AppSidebar` + `SidebarInset` with floating navbar + page content
- **`AppSidebar`** (`components/app-sidebar.tsx`), `variant="floating" collapsible="icon"`, Tacto-flavored: paper/sidebar-token card, hairline border, rounded-xl — hairlines over shadows:
  - **Header**: WorkspaceSwitcher — dropdown: active workspace name (+ slug in mono), list of workspaces w/ check on active, "Create workspace" opens dialog (name → `organization.create` + `setActive` + refresh)
  - **Content**: nav — Home, Library, Settings (lucide icons; active = accent bg + ink text; viridian stays reserved for touch/actions per token rule; icon-collapsed mode shows tooltips)
  - **Footer**: user card (avatar, name, email) → dropdown: theme toggle, sign out
- **Floating navbar** (`components/app-navbar.tsx`) inside `SidebarInset`: floating hairline card — `SidebarTrigger` (+ ⌘B `Kbd` hint), page title, right side: Capture button (`TouchRing` icon, disabled, "coming soon" tooltip)
- **Pages** (all inside `(app)/`):
  - `/home` — serif greeting ("Good evening, {name}."), Recent section w/ empty state (Guidejar-style home, Tacto editorial)
  - `/library` — moved from `app/library/`, guard removed (layout owns it)
  - `/settings` — Workspace section (rename via `organization.update`, members list read-only w/ roles) + Account section (name, email display)
- Root `/`: redirect — session → `/home`, else `/sign-in`. Design specimen moves to `/design` (internal reference page)

### 3. Plan stored in codebase (user request)
- First implementation step: `docs/plans/phase-02-workspaces-shell.md` — this plan, committed with the code. Also backfill `docs/plans/phase-01-auth.md` (short summary) so the docs dir starts complete.

## Design bar (must beat the references)
- Floating sidebar = quiet paper card, hairline border, rounded-xl, NO heavy shadow; content canvas stays paper
- Icon-collapse to a slim rail (LogoMark on top) — ⌘B, with `Kbd` hint in navbar tooltip
- Workspace switcher + counts in mono (machine voice); serif reserved for content (greeting, empty states)
- Dark mode first-class (tokens already inverted); reduced-motion respected (no new animations beyond existing system)
- Mobile: sidebar becomes sheet automatically (shadcn built-in)

## Order of implementation
1. docs/plans files (store the plan)
2. Schema models + migration + `auth.ts` plugin/hooks + middleware + workspace feature + contracts
3. Web: authClient plugin, sidebar component install, `(app)` layout + AppSidebar + navbar
4. Pages: home, library move, settings; root redirect; specimen → /design
5. Verify end-to-end

## Verification
1. Fresh sign-up → personal workspace auto-created (Prisma Studio: organization + member rows), lands on /home inside shell
2. Create second workspace via switcher → appears, becomes active, persists across refresh (session `activeOrganizationId`)
3. Switch workspaces → switcher + settings reflect; `GET /api/workspace/current` returns the active one; without session → 401
4. Sidebar: ⌘B collapse to icon rail, mobile sheet, state survives reload (cookie); navbar trigger works
5. Settings: rename workspace → reflects in switcher; members list shows owner
6. Sign out from sidebar footer → /sign-in; /home unauthenticated → redirect
7. `turbo typecheck && lint && build` green; dark mode + light mode visual pass (screenshots)

## Out of scope (this phase)
Invitations UI/email, member role management, workspace deletion, URL-scoped workspaces (`/w/slug`), knowledge spaces, guides schema — all later phases.
