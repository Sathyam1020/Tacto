"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronDown, Link2, Mail, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { inviteMemberSchema } from "@workspace/contracts/settings"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"

import { SettingSection, SettingsPage } from "@/components/settings/setting-section"
import { ConfirmDialog } from "@/components/settings/confirm-dialog"
import { SectionSkeleton } from "@/components/settings/section-skeleton"
import { authClient } from "@/lib/auth-client"
import { asRole, can, type WorkspaceAction } from "@/lib/permissions"
import { initialOf, timeAgo } from "@/lib/settings"

type Member = {
  id: string
  userId: string
  role: string
  createdAt: string | Date
  user: { name?: string | null; email?: string | null; image?: string | null }
}
type Invitation = { id: string; email: string; role?: string | null; status: string; expiresAt: string | Date }

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member" }

function inviteLink(id: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return `${origin}/invite/${id}`
}

async function copy(text: string, msg: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(msg)
  } catch {
    toast.error("Couldn't copy — copy it manually")
  }
}

export default function MembersPage() {
  const { data: session } = authClient.useSession()
  const { data: ws, isPending, refetch } = authClient.useActiveOrganization()
  const qc = useQueryClient()

  const invitations = useQuery({
    queryKey: ["settings", "invitations", ws?.id],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listInvitations()
      if (error) throw new Error(error.message ?? "Couldn't load invitations")
      return (data ?? []) as Invitation[]
    },
    enabled: !!ws?.id,
  })

  if (isPending || !ws) return <SectionSkeleton rows={3} />

  const members = (ws.members ?? []) as Member[]
  const myRole = asRole(members.find((m) => m.userId === session?.user.id)?.role)
  const allow = (a: WorkspaceAction) => can(myRole, a)
  const owners = members.filter((m) => m.role === "owner").length
  const pending = (invitations.data ?? []).filter((i) => i.status === "pending")
  const refetchInvites = () => qc.invalidateQueries({ queryKey: ["settings", "invitations", ws.id] })

  return (
    <SettingsPage>
      {allow("member:invite") && (
        <InviteForm onInvited={refetchInvites} />
      )}

      <SettingSection title="Members" description={`${members.length} ${members.length === 1 ? "person" : "people"} in this workspace.`}>
        <div className="divide-y divide-[var(--l-hairline)] overflow-hidden rounded-xl border border-[var(--l-hairline)]">
          {members.map((m) => {
            const isSelf = m.userId === session?.user.id
            const isOwner = m.role === "owner"
            const canManage = allow("member:role") && !isSelf && !isOwner
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="size-9">
                  {m.user.image && <AvatarImage src={m.user.image} alt="" />}
                  <AvatarFallback>{initialOf(m.user)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.user.name || m.user.email}
                    {isSelf && <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {m.user.email} · joined {timeAgo(m.createdAt)}
                  </p>
                </div>
                {canManage ? (
                  <RoleMenu
                    role={asRole(m.role)}
                    onChange={async (role) => {
                      const { error } = await authClient.organization.updateMemberRole({
                        memberId: m.id,
                        role,
                      })
                      if (error) toast.error(error.message ?? "Couldn't change role")
                      else {
                        toast.success("Role updated")
                        refetch()
                      }
                    }}
                    onRemove={
                      allow("member:remove")
                        ? async () => {
                            const { error } = await authClient.organization.removeMember({
                              memberIdOrEmail: m.id,
                            })
                            if (error) toast.error(error.message ?? "Couldn't remove")
                            else {
                              toast.success("Member removed")
                              refetch()
                            }
                          }
                        : undefined
                    }
                  />
                ) : (
                  <span className="rounded-md bg-muted px-2 py-1 text-[12px] font-medium text-muted-foreground">
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </SettingSection>

      {pending.length > 0 && (
        <SettingSection title="Pending invitations" description="Share the invite link — the person accepts by opening it while signed in.">
          <div className="divide-y divide-[var(--l-hairline)] overflow-hidden rounded-xl border border-[var(--l-hairline)]">
            {pending.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Mail className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {ROLE_LABEL[inv.role ?? "member"]} · expires {timeAgo(inv.expiresAt)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copy(inviteLink(inv.id), "Invite link copied")}>
                  <Link2 className="size-4" />
                  Copy link
                </Button>
                {allow("member:invite") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      const { error } = await authClient.organization.cancelInvitation({ invitationId: inv.id })
                      if (error) toast.error(error.message ?? "Couldn't cancel")
                      else {
                        toast.success("Invitation cancelled")
                        refetchInvites()
                      }
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        </SettingSection>
      )}

      <LeaveWorkspace
        orgId={ws.id}
        orgName={ws.name}
        soleOwner={myRole === "owner" && owners <= 1}
      />
    </SettingsPage>
  )
}

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<"admin" | "member">("member")
  const [busy, setBusy] = React.useState(false)

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    const parsed = inviteMemberSchema.safeParse({ email, role })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the email")
      return
    }
    setBusy(true)
    const { data, error } = await authClient.organization.inviteMember({
      email: parsed.data.email,
      role: parsed.data.role,
    })
    setBusy(false)
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't create the invitation")
      return
    }
    setEmail("")
    onInvited()
    await copy(inviteLink(data.id), "Invitation created — link copied")
  }

  return (
    <SettingSection title="Invite people" description="Add teammates by sharing an invite link. No email required.">
      <form onSubmit={invite} className="flex max-w-lg flex-wrap items-center gap-2">
        <Input
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1"
          aria-label="Invitee email"
        />
        <RolePicker role={role} onChange={setRole} />
        <Button type="submit" disabled={busy || !email.trim()}>
          {busy ? "Creating…" : "Create invite"}
        </Button>
      </form>
    </SettingSection>
  )
}

function RolePicker({ role, onChange }: { role: "admin" | "member"; onChange: (r: "admin" | "member") => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" className="min-w-24 justify-between" />}>
        {ROLE_LABEL[role]}
        <ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(["member", "admin"] as const).map((r) => (
          <DropdownMenuItem key={r} onClick={() => onChange(r)}>
            <span className="flex-1">{ROLE_LABEL[r]}</span>
            {role === r && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RoleMenu({
  role,
  onChange,
  onRemove,
}: {
  role: "owner" | "admin" | "member"
  onChange: (role: "admin" | "member") => void
  onRemove?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Member actions"
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted"
      >
        {ROLE_LABEL[role]}
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {(["member", "admin"] as const).map((r) => (
          <DropdownMenuItem key={r} onClick={() => onChange(r)}>
            <span className="flex-1">{ROLE_LABEL[r]}</span>
            {role === r && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              Remove from workspace
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LeaveWorkspace({ orgId, orgName, soleOwner }: { orgId: string; orgName: string; soleOwner: boolean }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="mt-8 flex items-center justify-between gap-6 rounded-xl border border-[var(--l-hairline)] px-5 py-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">Leave workspace</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {soleOwner
            ? "You are the only owner — transfer ownership or delete the workspace first."
            : "You will lose access to this workspace and its guides."}
        </p>
      </div>
      <Button variant="outline" disabled={soleOwner} onClick={() => setOpen(true)}>
        Leave
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Leave ${orgName}?`}
        description="You'll lose access to this workspace. You can be re-invited later."
        confirmLabel="Leave workspace"
        onConfirm={async () => {
          const { error } = await authClient.organization.leave({ organizationId: orgId })
          if (error) toast.error(error.message ?? "Couldn't leave")
          else {
            toast.success("Left the workspace")
            window.location.href = "/home"
          }
        }}
      />
    </div>
  )
}
