"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Building2,
  LogOut,
  type LucideIcon,
  MonitorSmartphone,
  Palette,
  Puzzle,
  Shield,
  User,
  Users,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { authClient } from "@/lib/auth-client"

type NavItem = { href: string; label: string; icon: LucideIcon }
type NavGroup = { label: string; items: NavItem[] }

/**
 * Settings' second-column nav (mirrors the Help Center / Forms panels). Grouped,
 * deep-linkable sections; grows one group at a time as phases land. "Sign out"
 * is pinned at the bottom for parity with the account menu.
 */
const GROUPS: NavGroup[] = [
  {
    label: "Account",
    items: [
      { href: "/settings/profile", label: "Profile", icon: User },
      { href: "/settings/security", label: "Security", icon: Shield },
      { href: "/settings/sessions", label: "Sessions", icon: MonitorSmartphone },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/settings/workspace", label: "General", icon: Building2 },
      { href: "/settings/members", label: "Members", icon: Users },
    ],
  },
  {
    label: "Preferences",
    items: [{ href: "/settings/appearance", label: "Appearance", icon: Palette }],
  },
  {
    label: "Connected",
    items: [{ href: "/settings/extension", label: "Extension", icon: Puzzle }],
  },
]

export function SettingsPanel() {
  const router = useRouter()
  const pathname = usePathname()

  async function signOut() {
    await authClient.signOut()
    router.replace("/sign-in")
  }

  return (
    <aside className="mt-1.5 mb-1.5 flex w-64 flex-none flex-col overflow-hidden rounded-l-3xl border-t border-r border-b border-l border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-panel-a)] to-[var(--l-panel-b)]">
      <div className="flex h-14 items-center border-b border-[var(--l-hairline)] px-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="mb-1 px-2.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-cobalt"
                      : "text-foreground hover:bg-foreground/[0.06]"
                  )}
                >
                  <Icon className={cn("size-4 flex-none", active ? "text-cobalt" : "text-muted-foreground")} />
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--l-hairline)] p-2">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-foreground transition-colors hover:bg-foreground/[0.06]"
        >
          <LogOut className="size-4 flex-none text-muted-foreground" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
