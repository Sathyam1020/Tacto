"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createWorkspaceSchema } from "@workspace/contracts/workspace"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { LogoMark } from "@workspace/ui/components/logo"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { authClient } from "@/lib/auth-client"
import { generateSlug } from "@/lib/slug"

/**
 * Workspace switcher — sidebar header. Shows the active workspace,
 * lists the rest, and creates new ones. Workspaces are better-auth
 * organizations under the hood.
 */
export function WorkspaceSwitcher() {
  const router = useRouter()
  const { data: workspaces } = authClient.useListOrganizations()
  const { data: activeWorkspace } = authClient.useActiveOrganization()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)

  // Self-heal: the very first session after sign-up may have no active
  // workspace (server hook ordering). Activate the first one automatically.
  const firstWorkspaceId = workspaces?.[0]?.id
  React.useEffect(() => {
    if (activeWorkspace === null && firstWorkspaceId) {
      void authClient.organization
        .setActive({ organizationId: firstWorkspaceId })
        .then(() => router.refresh())
    }
  }, [activeWorkspace, firstWorkspaceId, router])

  async function switchWorkspace(organizationId: string) {
    if (organizationId === activeWorkspace?.id) return
    await authClient.organization.setActive({ organizationId })
    router.refresh()
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = createWorkspaceSchema.safeParse({ name })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the name")
      return
    }

    setCreating(true)
    const { data, error: createError } = await authClient.organization.create({
      name: parsed.data.name,
      slug: generateSlug(parsed.data.name),
    })
    if (createError || !data) {
      setError(createError?.message ?? "Could not create the workspace")
      setCreating(false)
      return
    }

    await authClient.organization.setActive({ organizationId: data.id })
    setCreateOpen(false)
    setCreating(false)
    setName("")
    router.refresh()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" aria-label="Switch workspace" />}
          >
            <div className="bg-foreground text-background flex size-8 shrink-0 items-center justify-center rounded-lg">
              <LogoMark mono className="size-4.5" />
            </div>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">
                {activeWorkspace?.name ?? "Select workspace"}
              </span>
              <span className="text-muted-foreground truncate font-mono text-[10px]">
                {activeWorkspace?.slug ?? "—"}
              </span>
            </div>
            <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56"
            align="start"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
                Workspaces
              </DropdownMenuLabel>
              {(workspaces ?? []).map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => switchWorkspace(workspace.id)}
                >
                  <span className="flex-1 truncate">{workspace.name}</span>
                  {workspace.id === activeWorkspace?.id && (
                    <Check className="text-viridian size-4" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium tracking-tight">
              Create a workspace
            </DialogTitle>
            <DialogDescription>
              A separate space with its own guides and members.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Support"
                autoFocus
              />
            </div>
            {error && (
              <p role="alert" className="text-signal text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  )
}
