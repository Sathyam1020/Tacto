"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { createWorkspaceSchema } from "@workspace/contracts/workspace"
import {
  Check,
  ClipboardList,
  LifeBuoy,
  Moon,
  Plus,
  Sun,
  Users,
} from "lucide-react"

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
import { LogoutIcon } from "@workspace/ui/components/logout"
import { SettingsIcon } from "@workspace/ui/components/settings"

import { RailButton, Reticle } from "@/components/app-shell/shell-bits"
import { useLibraryViewState } from "@/components/app-shell/view-context"
import { authClient } from "@/lib/auth-client"
import { generateSlug } from "@/lib/slug"

/** Compact workspace switcher — the reticle brand mark opens it. */
function RailWorkspaceSwitcher() {
  const router = useRouter()
  const { data: workspaces } = authClient.useListOrganizations()
  const { data: activeWorkspace } = authClient.useActiveOrganization()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)

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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Switch workspace"
          className="mb-2 flex size-10 items-center justify-center rounded-xl text-cobalt outline-none transition-colors hover:bg-[var(--l-hover)] focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Reticle />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Workspaces
            </DropdownMenuLabel>
            {(workspaces ?? []).map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => switchWorkspace(w.id)}
              >
                <span className="flex size-5 items-center justify-center rounded bg-ink text-[10px] font-semibold text-paper">
                  {w.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 truncate">{w.name}</span>
                {w.id === activeWorkspace?.id && (
                  <Check className="size-4 text-cobalt" />
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Create a workspace
            </DialogTitle>
            <DialogDescription>
              A separate space with its own guides and members.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-name">Name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Support"
                autoFocus
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
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
    </>
  )
}

/** Account dropdown — theme toggle + sign out. */
function RailAccount() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!session) return null
  const { name, email } = session.user
  const initial = (name || email).charAt(0).toUpperCase()

  async function handleSignOut() {
    await authClient.signOut()
    router.replace("/sign-in")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="mt-1 flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-xs font-semibold text-paper">
          {initial}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {email}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Appearance
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun className="size-4" />
            Light
            {mounted && theme === "light" && (
              <Check className="ml-auto size-4" />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon className="size-4" />
            Dark
            {mounted && theme === "dark" && (
              <Check className="ml-auto size-4" />
            )}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogoutIcon size={16} className="shrink-0" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The icon rail — workspace switcher, primary nav, help/settings, account. */
export function Rail() {
  const router = useRouter()
  const pathname = usePathname()
  const { setView } = useLibraryViewState()

  const onForms = pathname?.startsWith("/forms") ?? false
  const onHelp = pathname?.startsWith("/help-center") ?? false
  const onLibrary = pathname === "/home"

  return (
    <nav className="flex w-14 flex-none flex-col items-center gap-1.5 py-3.5">
      <RailWorkspaceSwitcher />

      <RailButton
        label="Library"
        active={onLibrary}
        onClick={() => {
          setView({ type: "all" })
          if (!onLibrary) router.push("/home")
        }}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 5a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        </svg>
      </RailButton>
      <RailButton
        label="Forms"
        active={onForms}
        onClick={() => {
          setView({ type: "all" })
          if (!onForms) router.push("/forms")
        }}
      >
        <ClipboardList className="size-[19px]" />
      </RailButton>
      <RailButton label="Analytics">
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      </RailButton>
      <RailButton label="Teams">
        <Users className="size-[19px]" />
      </RailButton>

      <div className="flex-1" />

      <RailButton
        label="Help center"
        active={onHelp}
        onClick={() => {
          if (!onHelp) router.push("/help-center")
        }}
      >
        <LifeBuoy className="size-[19px]" />
      </RailButton>
      <RailButton
        label="Settings"
        active={pathname.startsWith("/settings")}
        onClick={() => router.push("/settings")}
      >
        <SettingsIcon size={19} />
      </RailButton>
      <RailAccount />
    </nav>
  )
}
