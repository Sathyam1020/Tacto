# Phase 14 — Settings — Implementation Plan

**Status:** ✅ Shipped (Phases 1–6 complete) · **Source of truth for build** · Companion to `phase-14-settings-rfc.md`
**Branch:** `feat/settings` · **Scope:** `apps/web`, `apps/api`, `packages/{contracts,db,ui,storage}`

> Lives in `docs/plans/` beside the RFC + the phase-11/12/13 plans (the established location).
> Settings manages exactly four things — **Account · Workspace · Preferences · Connected**. It is not a dashboard and not a CRUD page. Every page is single-responsibility, deep-linkable, and reuses better-auth + Organizations + Sessions + Invitations + R2 uploads + the existing App Shell. Quality bar: Linear / Stripe / Vercel — calm, minimal, fast, hairline borders, generous whitespace, no heavy cards, no dashboard aesthetics.

---

## 0. Small improvements to fold into every phase

1. **`SettingSection`** — the one grouping primitive: `title` · `description` · `children` · optional `actions`. No random cards.
2. **`SettingRow`** (label + description + control, hairline-separated) and **`DangerZone`** (destructive card). Every page uses the same layout + spacing.
3. **Optimistic updates** where safe: profile name, workspace name, workspace logo, avatar, theme update immediately (rollback on error).
4. **Explicit Save** for anything unsafe to autosave: passwords, destructive actions.
5. **Members rows:** avatar · name · email · role · joined date · last active (if available). Change role · remove.
6. **Invitations:** copy invite link · cancel. **No email dependency** — links are the source of truth in V1.
7. **Uploads:** drag & drop · click · replace · remove. Leave room for future cropping (do not build it).
8. **Appearance:** Light/Dark/System now; structured so language/density/timezone/notifications slot in later without a redesign.
9. **Extension:** connected status · browser · version (if available) · reconnect · open extension. Reuse existing integration.
10. **Destructive actions:** typed-confirmation dialogs that spell out consequences (delete account, delete workspace, leave workspace).

---

## 1. Architecture summary

```
Rail ▸ Settings ──► SettingsPanel (2nd column) ──► /settings/[section] (content card)
        │                                              Account:   profile · security · sessions
        │                                              Workspace: workspace(general) · members
        │                                              Prefs:     appearance
        │                                              Connected: extension
        └── all mutations route through better-auth client (authClient.*) — no new identity/org system
```

- **Reuse, don't rebuild.** Identity/sessions/social/password/org/members/invites are all better-auth. Uploads reuse `@workspace/storage` presign. The 2nd-column panel mirrors `HelpCenterPanel`/`FormsPanel`. The shell is the existing `AppShell`.
- **No schema changes in v1.** `User.image`/`Organization.logo` hold the avatar/logo (R2 key, presigned on read); `Session` already carries `ipAddress`/`userAgent`/`updatedAt`; `Invitation` already models pending invites.
- **Email-optional.** Invitations are link-based (`/invite/[id]` acceptance); password change is in-session; email-change is read-only until Resend. Seams left so email lights them up later with no rework.

---

## 2. Route structure (deep-linkable, `(app)` group)

| Route | Section | Responsibility |
|---|---|---|
| `/settings` | — | redirect → `/settings/profile` |
| `/settings/profile` | Account | name, avatar, email (read-only) |
| `/settings/security` | Account | password, connected accounts |
| `/settings/sessions` | Account | active sessions, revoke |
| `/settings/workspace` | Workspace | name, slug, logo (admin/owner write) |
| `/settings/members` | Workspace | members, roles, invites, leave |
| `/settings/appearance` | Preferences | theme |
| `/settings/extension` | Connected | status, reconnect, open |
| `/invite/[id]` | — | accept a link-based invitation |

`/settings/profile` also carries the account **Danger Zone** (delete account) footer; `/settings/workspace` carries the workspace Danger Zone (delete/leave). *(Could split into `/settings/danger` later; folded for now to keep sections focused.)*

---

## 3. Component hierarchy

```
app/(app)/settings/layout.tsx          → useSetNavbar("Settings"); renders child
app/(app)/settings/[section]/page.tsx  → one client page per section
components/app-shell/settings-panel.tsx→ 2nd-column nav (grouped links + Sign out)
components/settings/
  setting-section.tsx    → <SettingSection title description actions>{children}</>
  setting-row.tsx        → <SettingRow label description>{control}</>
  danger-zone.tsx        → <DangerZone> + <DangerAction>
  confirm-dialog.tsx     → typed-confirmation dialog (match text to enable)
  image-upload.tsx       → drag/click/replace/remove → presign → onChange(url)
  avatar-field.tsx       → user avatar via image-upload
  section-skeleton.tsx   → shared loading skeleton
sections (in page files or components/settings/sections/*):
  ProfileSection, SecuritySection, SessionsSection,
  WorkspaceGeneralSection, MembersSection, AppearanceSection, ExtensionSection
app/(app)/invite/[id]/page.tsx         → accept-invitation landing
```

App-shell: add `inSettings = pathname.startsWith("/settings")` → render `<SettingsPanel />` (today it wrongly renders `FoldersPanel`).

---

## 4. Database usage (no new tables)

| Data | Source | Notes |
|---|---|---|
| name, email, avatar | `User.name/email/image` | avatar = R2 key, presigned on read |
| password, providers | `Account` (providerId, password) | drives "you sign in with Google" |
| sessions | `Session` (ipAddress, userAgent, updatedAt) | last-active = `updatedAt`; current = token match |
| workspace name/slug/logo | `Organization.name/slug/logo` | slug unique; collision → 409 |
| members + roles | `Member` (role, createdAt) | joined = `createdAt` |
| invitations | `Invitation` (email, role, status, expiresAt) | link-based acceptance |

R2 avatar/logo keys use the `img/user/{userId}/…` and `img/org/{orgId}/…` prefixes (mirrors capture keys). Deleting/replacing best-effort removes the old object.

---

## 5. better-auth integration (client — `authClient.*`, all verified in 1.6.23)

- **Account:** `updateUser({ name, image })` · `changePassword({ currentPassword, newPassword, revokeOtherSessions })` · `changeEmail` *(deferred — read-only)* · `linkSocial({ provider })` · `unlinkAccount({ providerId })` · `deleteUser()`.
- **Sessions:** `listSessions()` · `revokeSession({ token })` · `revokeOtherSessions()`.
- **Workspace:** `organization.update({ organizationId, data: { name, slug, logo } })` · `organization.delete({ organizationId })`.
- **Members/invites:** `organization.inviteMember({ email, role })` · `listInvitations()` · `cancelInvitation({ invitationId })` · `acceptInvitation({ invitationId })` · `updateMemberRole({ memberId, role })` · `removeMember({ memberIdOrEmail })` · `organization.leave({ organizationId })`.
- **Server config (`apps/api/src/lib/auth.ts`):** enable `user: { deleteUser: { enabled: true } }` (fresh-session gated); register no-op `sendInvitationEmail`/`sendResetPassword` seams (Resend later). Confirm `changePassword`/`unlinkAccount` defaults. **Change is additive** — no behavior change to existing flows.

---

## 6. Upload flow (avatar + workspace logo)

```
client: pick/drop file → validate (type ∈ {png,jpeg,webp}, ≤ 2MB)
      → POST /api/uploads/image { kind: "avatar"|"logo", contentType }
api:   auth + workspace; presignPut(`img/{scope}/{id}/{nanoid}`, contentType)
      → { key, uploadUrl, url }        (url = presignGet or stable read URL)
client: PUT file → uploadUrl (R2)
      → authClient.updateUser({ image: url })  /  organization.update({ logo: url })
      → optimistic preview; best-effort delete old object server-side on replace
```

New endpoint: **`POST /api/uploads/image`** (`features/uploads/router.ts`), mounted in `app.ts`. Contract `imageUploadSchema` (kind + contentType). Reuses `presignPut`/`deleteObject` from `@workspace/storage`.

---

## 7. Permission model

Roles: **owner > admin > member** (better-auth built-ins; no custom roles).

| Action | owner | admin | member |
|---|---|---|---|
| Edit own profile / security / sessions | ✓ | ✓ | ✓ |
| Edit workspace name/slug/logo | ✓ | ✓ | — (read-only) |
| Invite / change role / remove member | ✓ | ✓ | — |
| Leave workspace | ✓* | ✓ | ✓ |
| Delete workspace | ✓ | — | — |
| Delete own account | ✓ | ✓ | ✓ |

*owner can leave only if not the sole owner (else must transfer/delete first). A pure **`can(role, action)`** helper (`lib/permissions.ts`) is the single source, unit-tested; the UI hides/disables and the server (better-auth) enforces. Sole-owner and self-remove guards live in the helper + confirmed server-side.

---

## 8. Testing strategy

- **Pure/unit:** `can(role, action)` permission table; `profileSchema`/`passwordChangeSchema`/`inviteMemberSchema`/`imageUploadSchema` accept-reject; `userAgent → device label` parser; slug validation.
- **API:** `/api/uploads/image` validates type/size + scopes keys to the caller; auth-config smoke (deleteUser enabled + gated).
- **Manual E2E (per phase):** name/avatar → rail updates; password change revokes other sessions; revoke session kills it; rename workspace/slug → public help URL updates; invite link → 2nd account accepts → member appears; change role/remove/leave; delete workspace (blast-radius); delete account (sole-owner guard); theme persists; responsive + keyboard; no dark-flash.
- **Gate:** `turbo build typecheck lint` + api/db tests green after **every** phase.

---

## 9. Rollout order (commit after each; each independently green) — ✅ all shipped

1. ✅ **Phase 1 — Shell + Profile + Appearance.** `SettingsPanel`, sub-route layout + redirect, app-shell `inSettings`, shared primitives, Profile (name + avatar + `/api/uploads/image` + `/api/img/*` proxy), Appearance.
2. ✅ **Phase 2 — Security + Sessions.** Change password, connected accounts, active sessions + revoke / revoke-others.
3. ✅ **Phase 3 — Workspace General.** Name + slug + logo, role-gated (`can`).
4. ✅ **Phase 4 — Members + Invitations.** List/roles/remove/leave + link-based invite + `/invite/[id]` acceptance (outside `(app)` so the extension gate doesn't block new invitees).
5. ✅ **Phase 5 — Danger Zones.** Delete account (typed email confirm, `beforeDelete` drops solely-owned workspaces), delete workspace (owner-only, typed name confirm).
6. ✅ **Phase 6 — Extension + Polish.** Extension section (status/browser/reconnect via existing `useExtension`); loading skeletons; role/permission guards; docs marked Shipped.

---

## 10. Files to modify / add

- **contracts:** `src/settings.ts` (new: profile/password/invite/image schemas + `WorkspaceRole` reuse) + `package.json` subpath.
- **db:** none (reuse). *(Only if a genuine gap appears — STOP and raise it.)*
- **storage:** reuse `presignPut`/`presignGet`/`deleteObject`.
- **api:** `features/uploads/router.ts` (new) + `app.ts` mount; `lib/auth.ts` (enable `deleteUser`, email seams).
- **web (shell):** `components/app-shell/app-shell.tsx` (`inSettings`), `components/app-shell/settings-panel.tsx` (new), `components/app-shell/rail.tsx` (Settings already wired).
- **web (settings):** `app/(app)/settings/layout.tsx` + `app/(app)/settings/[section]/page.tsx` (replace the old `settings/page.tsx`), `components/settings/*` (primitives + sections), `lib/settings.ts` (react-query hooks + upload helper + `lib/permissions.ts`).
- **web (invite):** `app/(app)/invite/[id]/page.tsx` (new).
- **docs:** this plan + the RFC; mark Shipped at the end.

---

## 11. Guardrails

- Do **not** build: Billing, API keys, Notification prefs, SSO, Passkeys, 2FA, Audit logs, Custom permissions/roles, image cropping.
- Do **not** add dependencies unless unavoidable (raise first).
- If an architectural conflict appears (e.g. better-auth can't do X the RFC assumes): **STOP, explain, wait.**
