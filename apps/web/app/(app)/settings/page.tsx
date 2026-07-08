"use client"

import * as React from "react"
import { renameWorkspaceSchema } from "@workspace/contracts/workspace"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"

import { authClient } from "@/lib/auth-client"

/** Settings — workspace (rename, members) and account sections. */
export default function SettingsPage() {
  const { data: session } = authClient.useSession()
  const { data: activeWorkspace, refetch } = authClient.useActiveOrganization()

  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Sync the form when the active workspace loads/switches.
  React.useEffect(() => {
    if (activeWorkspace) setName(activeWorkspace.name)
  }, [activeWorkspace])

  async function handleRename(event: React.FormEvent) {
    event.preventDefault()
    if (!activeWorkspace) return
    setError(null)
    setSaved(false)

    const parsed = renameWorkspaceSchema.safeParse({ name })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the name")
      return
    }

    setSaving(true)
    const { error: updateError } = await authClient.organization.update({
      organizationId: activeWorkspace.id,
      data: { name: parsed.data.name },
    })
    setSaving(false)
    if (updateError) {
      setError(updateError.message ?? "Could not rename the workspace")
      return
    }
    setSaved(true)
    refetch()
  }

  const members = activeWorkspace?.members ?? []

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-14">
      {/* ── Workspace ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-muted-foreground border-b pb-3 font-mono text-xs tracking-widest uppercase">
          Workspace
        </h2>

        <form onSubmit={handleRename} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-name">Name</Label>
            <div className="flex gap-2">
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSaved(false)
                }}
                className="max-w-sm"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={saving || name === activeWorkspace?.name}
              >
                {saving ? "Saving…" : saved ? "Saved" : "Save"}
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-signal text-sm">
                {error}
              </p>
            )}
          </div>
          <p className="text-muted-foreground font-mono text-xs">
            slug: {activeWorkspace?.slug ?? "—"}
          </p>
        </form>

        <h3 className="mt-10 text-sm font-medium">Members</h3>
        <div className="mt-2">
          {members.map((member) => (
            <div key={member.id}>
              <Separator />
              <div className="flex items-center gap-3 py-3">
                <Avatar className="size-8">
                  <AvatarFallback>
                    {(member.user?.name || member.user?.email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm">{member.user?.name}</p>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {member.user?.email}
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {member.role}
                </Badge>
              </div>
            </div>
          ))}
          <Separator />
          <p className="text-muted-foreground mt-3 text-xs">
            Invitations are coming soon.
          </p>
        </div>
      </section>

      {/* ── Account ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-muted-foreground border-b pb-3 font-mono text-xs tracking-widest uppercase">
          Account
        </h2>
        <div className="mt-6 flex flex-col gap-4 text-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <span className="text-muted-foreground">Name</span>
            <span>{session?.user.name}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-4">
            <span className="text-muted-foreground">Email</span>
            <span className="font-mono text-xs">{session?.user.email}</span>
          </div>
        </div>
      </section>
    </div>
  )
}
