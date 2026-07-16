# Phase 14 — Settings — RFC

**Status:** ✅ Shipped (2026-07-16) · **Author:** Principal Eng · **Date:** 2026-07-16
**Scope:** `apps/web`, `apps/api`, `packages/{contracts,db,ui,storage}` · builds on better-auth (identity + organizations), R2 storage, and the app shell

---

## 1. Summary

Turn the placeholder Settings page into a **complete, production-grade settings surface** covering the three things every SaaS user expects to control: **their account**, **their workspace**, and **their preferences**. Today `/settings` is a single scroll with workspace-rename + a read-only member list + read-only name/email (and it incongruously renders the guide *folders* panel beside it). This RFC replaces it with a properly organized, deep-linkable settings area that reuses better-auth's existing account/organization capabilities, the R2 upload path, and the app's double-sidebar shell.

### The one hard constraint: no email yet

Email (Resend) is not wired (`auth.ts` says "wired later"). That blocks the *email-dependent* halves of three flows: **member invitations**, **password reset**, and **email-change verification**. Rather than stub them, this RFC ships each in an **email-optional** form now (link-based invites, in-session password change, email shown read-only) and leaves a clean seam so enabling Resend later lights them up with no rework. This is the primary design decision and is called out at each site.

### Two audiences (the product in one breath)

- **The individual** manages who they are: name + avatar, password + connected Google account, active sessions across devices, and (danger) deleting their account.
- **The workspace owner/admin** manages the shared space: name/slug/logo, members and their roles, pending invites, and (danger) deleting or leaving the workspace.

### Guiding principles

Reuse better-auth, don't rebuild identity · One surface, many sections (deep-linkable) · Every destructive action is gated + confirmed + honest about blast radius · Role-aware (owner > admin > member) · Email-optional now, email-ready later · Type-safe end to end · Accessible, responsive, no dark-flash · Each phase ships independently green.

### Non-goals (v1 — deferred)

- **Billing / plans / usage** (no Stripe in the codebase; a `Billing` section is a later phase).
- **Email-delivered** invites / password resets / verification (ships the moment Resend lands; link-based + in-session variants now).
- **SSO / SAML / SCIM**, 2FA/MFA, passkeys.
- **Named API tokens / OAuth apps** management (the extension uses the session bearer today; a `PersonalAccessToken` model is a later phase).
- **Audit log**, per-member granular permissions beyond the three built-in roles, org transfer of ownership UI (API-only fallback).
- **Notification preferences** (needs email/push first).

---

## 2. Information architecture

A second-column **`SettingsPanel`** (mirroring `HelpCenterPanel`/`FormsPanel`) plus **sub-routes**, so each section is shareable, code-split, and back-button friendly. `/settings` redirects to `/settings/profile`.

```
Rail ▸ Settings                        content card
┌───────────────┐   ┌───────────────────────────────────┐
│ ACCOUNT       │   │  (active section)                 │
│  Profile      │   │                                   │
│  Security     │   │                                   │
│  Sessions     │   │                                   │
│ WORKSPACE     │   │                                   │
│  General      │   │                                   │
│  Members      │   │                                   │
│ PREFERENCES   │   │                                   │
│  Appearance   │   │                                   │
│ CONNECTED     │   │                                   │
│  Extension    │   │                                   │
└───────────────┘   └───────────────────────────────────┘
```

Routes (all under the authenticated `(app)` group): `/settings/profile`, `/settings/security`, `/settings/sessions`, `/settings/workspace`, `/settings/members`, `/settings/appearance`, `/settings/extension`. The app-shell learns `inSettings` and renders `<SettingsPanel />` in the second column (today it wrongly shows `FoldersPanel`).

**Role gating:** Workspace ▸ General and Members are visible to all members but **write-gated** to `admin`/`owner`; delete-workspace is `owner`-only; a `member` sees read-only workspace info + a "Leave workspace" action.

---

## 3. Data model (`packages/db/prisma/schema.prisma`)

Almost entirely **reuse** — better-auth already owns `User`, `Session`, `Account`, `Organization`, `Member`, `Invitation`. Deltas:

- **No new tables required for v1.** `User.image` (avatar) and `Organization.logo` already exist; `Session` already carries `ipAddress` + `userAgent` + `updatedAt` (device/last-active); `Invitation` already has `email`/`role`/`status`/`expiresAt`.
- **Avatar/logo storage:** store the **R2 object key** in `User.image` / `Organization.logo` (prefixed `img/` — same convention as capture keys) and presign on read, OR store a stable public URL. (Decision in §7.) No schema change either way.
- **Deferred (not this phase):** `PersonalAccessToken` (named extension/API tokens), `User.preferences Json?` (notification prefs). Theme stays client-side in next-themes localStorage; no column.

Net schema change for v1: **none** (additive image-key convention only).

---

## 4. Sections in detail

### 4.1 Account ▸ Profile  (`/settings/profile`)
- **Avatar** — upload (drag/click) → R2 presigned PUT → `authClient.updateUser({ image })`. Remove → clears to initials.
- **Display name** — inline edit → `authClient.updateUser({ name })`. Validated by a `profileSchema` (1–50 chars).
- **Email** — shown read-only with a "verified/unverified" chip. Change is **deferred** (needs a verification email); the field explains why and links nowhere until Resend lands.

### 4.2 Account ▸ Security  (`/settings/security`)
- **Password** — `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions })`. Only shown for users who have a password account (email/password signups); Google-only users see "You sign in with Google."
- **Connected accounts** — list social providers; **link** Google (`authClient.linkSocial`) / **unlink** (`authClient.unlinkAccount`), with a guard against unlinking your only login method.
- **Forgot-password (in-app)** is unnecessary here (the user is authenticated); the reset *email* flow is deferred.

### 4.3 Account ▸ Sessions  (`/settings/sessions`)
- **Active sessions** — `authClient.listSessions()` → device (parsed from `userAgent`), IP, "last active" (`updatedAt`), "this device" marker for the current session.
- **Revoke** one (`revokeSession`) / **Sign out everywhere else** (`revokeOtherSessions`). Best-effort, optimistic list update.

### 4.4 Account ▸ Danger (folded into Profile footer or its own card)
- **Delete account** — typed-confirmation dialog ("type your email"). Calls `authClient.deleteUser()` (enable in `auth.ts` with `deleteUser: { enabled: true }`, gated on a fresh session / password). Copy spells out the blast radius: **owned workspaces and all their guides/forms/help centers are deleted** (FK cascade). Sole-owner workspaces block deletion until transferred or deleted.

### 4.5 Workspace ▸ General  (`/settings/workspace`)  *(admin/owner write)*
- **Name** — `authClient.organization.update({ data: { name } })` (reuses `renameWorkspaceSchema`).
- **Slug** — editable with the **same collision-checked pattern as the Help Center** (`slugSchema`, 409 on clash). Note: changing it changes public URLs.
- **Logo** — upload → R2 → `organization.update({ data: { logo } })`.
- **Workspace id / created** — read-only reference.

### 4.6 Workspace ▸ Members  (`/settings/members`)
- **Members list** — avatar, name, email, **role dropdown** (owner/admin/member) editable by owner/admin (`organization.updateMemberRole`), **remove** (`organization.removeMember`) with guards (can't remove the sole owner; can't remove yourself — use Leave).
- **Pending invitations** — `organization.listInvitations` → email, role, expiry, **cancel** (`cancelInvitation`), **copy invite link**.
- **Invite** — enter email + role → `organization.inviteMember`. **Email-optional handling (the key decision):** the call creates a pending `Invitation`; because no mailer is configured, we surface a **copyable invite link** `/(app)/invite/[id]`. The invitee opens it, signs in/up, and accepts (`organization.acceptInvitation`). When Resend lands, the same call also emails the link — **zero UI rework**.
- **Leave workspace** — `organization.leave` (any non-sole-owner member).

### 4.7 Preferences ▸ Appearance  (`/settings/appearance`)
- **Theme** — light / dark / system, via `next-themes` `setTheme` (consolidates the toggle currently buried in the rail account dropdown; the dropdown can keep a shortcut or defer to here).

### 4.8 Connected ▸ Extension  (`/settings/extension`)
- **Status** — connected / not connected (reuses `useExtension`), the connected browser, and a **Reconnect** button (re-runs the token handoff via `/api/extension/token`). Named/revocable tokens are deferred (§1 non-goals).

---

## 5. Surfaces & layout (`apps/web`)

- **`components/app-shell/settings-panel.tsx`** (new) — the second-column nav (grouped links above, "Sign out" pinned at the bottom like the account dropdown). Active state from `usePathname`.
- **`app/(app)/settings/layout.tsx`** — shared section header + the `useSetNavbar("Settings")` title; renders the routed child.
- **`app/(app)/settings/[section]/page.tsx`** — one file per section (or a folder each), all client components using `authClient` + react-query.
- **`app/(app)/invite/[id]/page.tsx`** (new) — accept-invitation landing (link-based invites).
- **app-shell** gains `inSettings` → `<SettingsPanel />`.
- **Primitives reused:** `Tabs` (not needed if panel-routed), `Dialog` (danger confirms), `Switch`, `Select` (role), `Avatar`, `Separator`, `Input`, `Button`, `DropdownMenu`, `Tooltip`, `Skeleton`, plus the analytics-style `Panel`/section cards for consistent grouping. A shared **`SettingRow`** (label + description + control) and **`DangerZone`** card keep every section visually consistent.

---

## 6. API surface

Most actions go **directly through better-auth** client methods (proxied to `/api/auth/*`), so **no new app endpoints** for identity/org mutations. Net-new API is small:

- **`POST /api/uploads/image`** (auth) — presigned PUT for an avatar/logo (mirrors capture's `presignPut`; validates content-type + size; returns `{ key, uploadUrl, url }`). Scoped so a user can only write `img/user/{id}/…` or `img/org/{activeOrg}/…`.
- **Server auth config (`apps/api/src/lib/auth.ts`):** enable `user.deleteUser`, confirm `account.changeEmail`/`changePassword` options, and register the (no-op-until-Resend) `sendInvitationEmail`/`sendResetPassword` callbacks so the seams exist.
- **Contracts (`packages/contracts/src/settings.ts`):** `profileSchema`, `passwordChangeSchema`, `inviteMemberSchema` (email + role), `imageUploadSchema` (mime/size), reused `slugSchema` for workspace slug.

---

## 7. Key decisions (recommendations)

1. **Invitations → link-based now, email later (recommended).** Unblocks real team collaboration without email infra; `acceptInvitation` + an `/invite/[id]` page; auto-emails when Resend lands. *Alt: defer members entirely — rejected (members is table-stakes for "production").*
2. **Avatar/logo → store the R2 key, presign on read (recommended)** — consistent with guide screenshots, no public-bucket exposure, easy signed-URL rotation. *Alt: public URL — simpler reads but needs a public bucket/CDN policy.*
3. **Layout → panel + sub-routes (recommended)** over tabs/scroll — matches Help Center/Forms, deep-linkable, code-split.
4. **Theme persistence → stay client-side** (next-themes) for v1; a server `preferences` column only when notifications arrive.
5. **Account/workspace deletion → typed-confirm + role/sole-owner guards**; enable `deleteUser` in auth config with a fresh-session requirement.

---

## 8. Reuse map (what we do NOT rebuild)

| Need | Reuse |
|---|---|
| Identity, password, sessions, social link | better-auth core client (`updateUser`/`changePassword`/`listSessions`/`revokeSession`/`unlinkAccount`/`deleteUser`) |
| Members, roles, invites | better-auth `organization` plugin (`updateMemberRole`/`removeMember`/`inviteMember`/`acceptInvitation`/`leave`) |
| Slug uniqueness + validation | Help Center `slugSchema` + 409-collision pattern |
| Image upload | `@workspace/storage` `presignPut`/`presignGet` (capture path) |
| Second-column nav | `HelpCenterPanel` structure + `RailButton`/`ViewRow` |
| Section cards, rows, danger | analytics `Panel` + new `SettingRow`/`DangerZone` |
| Theme | `next-themes` (already in the rail dropdown) |
| Extension status | `useExtension` + `/api/extension/token` |

Net-new: `SettingsPanel`, the section routes, `SettingRow`/`DangerZone`, one image-upload endpoint, the `/invite/[id]` acceptance page.

---

## 9. Phasing (each ships independently green)

1. **Shell + Profile.** `SettingsPanel` + sub-route layout + app-shell `inSettings`; Profile (name + avatar upload endpoint) + Appearance (theme). Replaces the current page. *Immediately better + releasable.*
2. **Security + Sessions.** Change password, connected accounts, active sessions + revoke.
3. **Workspace General.** Name + slug (collision-checked) + logo, role-gated.
4. **Members + Invitations.** List/roles/remove/leave + link-based invite + `/invite/[id]` acceptance.
5. **Danger zones.** Delete account, delete/leave workspace, with guards + typed confirms + auth-config changes.
6. **Polish.** a11y sweep, responsive, loading skeletons, empty states, role-permission edge cases, docs; mark Shipped.

*(Extension section folds into Phase 1 or 6 — trivial, reuses `useExtension`.)*

---

## 10. Testing

- **Contract/unit:** `profileSchema`/`passwordChangeSchema`/`inviteMemberSchema` accept/reject; slug collision; role-permission helper (who-can-do-what) as a pure function + table test.
- **API:** image-upload endpoint validates mime/size + scopes keys; auth-config smoke (deleteUser gated).
- **Manual E2E:** edit name/avatar → reflected in rail; change password → other sessions revoked; revoke a session → it dies; rename workspace/slug → public help URL updates; invite (copy link) → second account accepts → appears as member; change role/remove; leave; delete workspace (blast-radius confirm); delete account (sole-owner guard); theme persists; all sections responsive + keyboard-navigable; no dark-flash.
- **Per phase:** `turbo build typecheck lint` + api/db tests green.

---

## 11. Open questions

1. **Invitations:** confirm link-based for v1 (vs. waiting for Resend). Recommendation: link-based.
2. **Avatar/logo:** store R2 key + presign, or a public URL? Recommendation: key + presign.
3. **Ownership transfer:** needed in v1, or API-only until a later phase? (Affects sole-owner delete guards.) Recommendation: defer UI; guard blocks sole-owner delete with a clear message.
4. **Email-change:** show read-only now (recommended), or attempt better-auth `changeEmail` without verification (riskier)?
5. **Roles:** are `owner/admin/member` the final set, or is a custom-permission model coming (affects the Members UI)? Recommendation: ship the three built-ins.
