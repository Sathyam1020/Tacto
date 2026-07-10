"use client"

import { useRouter } from "next/navigation"
import { ChevronsUpDown } from "lucide-react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { LogoutIcon } from "@workspace/ui/components/logout"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { authClient } from "@/lib/auth-client"

/** Sidebar footer — the signed-in user + sign out. */
export function NavUser() {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  if (!session) return null

  const { name, email } = session.user
  const initial = (name || email).charAt(0).toUpperCase()

  async function handleSignOut() {
    await authClient.signOut()
    router.replace("/sign-in")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" aria-label="Account menu" />}
          >
            <Avatar className="size-8">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="text-muted-foreground truncate font-mono text-[10px]">
                {email}
              </span>
            </div>
            <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56"
            align="start"
            side="top"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {email}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogoutIcon size={16} className="shrink-0" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
