"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Monitor, Smartphone } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { SettingSection, SettingsPage } from "@/components/settings/setting-section"
import { SectionSkeleton } from "@/components/settings/section-skeleton"
import { authClient } from "@/lib/auth-client"
import { parseUserAgent, timeAgo } from "@/lib/settings"

type SessionRow = {
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  updatedAt: string | Date
  createdAt: string | Date
}

export default function SessionsPage() {
  const { data: session } = authClient.useSession()
  const currentToken = (session?.session as { token?: string } | undefined)?.token

  const { data, isPending, refetch } = useQuery({
    queryKey: ["settings", "sessions"],
    queryFn: async () => {
      const { data, error } = await authClient.listSessions()
      if (error) throw new Error(error.message ?? "Couldn't load sessions")
      return (data ?? []) as SessionRow[]
    },
  })

  if (isPending || !data) return <SectionSkeleton rows={3} />

  // Current session first, then most-recently-active.
  const sessions = [...data].sort((a, b) => {
    if (a.token === currentToken) return -1
    if (b.token === currentToken) return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
  const others = sessions.filter((s) => s.token !== currentToken).length

  async function revoke(token: string) {
    const { error } = await authClient.revokeSession({ token })
    if (error) toast.error(error.message ?? "Couldn't revoke")
    else {
      toast.success("Session signed out")
      refetch()
    }
  }

  async function revokeOthers() {
    const { error } = await authClient.revokeOtherSessions()
    if (error) toast.error(error.message ?? "Couldn't sign out other sessions")
    else {
      toast.success("Signed out of all other sessions")
      refetch()
    }
  }

  return (
    <SettingsPage>
      <SettingSection
        title="Active sessions"
        description="Devices where you're signed in. Revoke any you don't recognize."
        actions={
          others > 0 ? (
            <Button size="sm" variant="outline" onClick={revokeOthers}>
              Sign out others
            </Button>
          ) : undefined
        }
      >
        <div className="divide-y divide-[var(--l-hairline)] overflow-hidden rounded-xl border border-[var(--l-hairline)]">
          {sessions.map((s) => {
            const { browser, os } = parseUserAgent(s.userAgent)
            const isMobile = /iOS|Android/.test(os)
            const current = s.token === currentToken
            return (
              <div key={s.token} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {isMobile ? <Smartphone className="size-4" /> : <Monitor className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {browser} on {os}
                    {current && (
                      <span className="rounded-full bg-[var(--l-success)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--l-success)]">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {s.ipAddress || "Unknown IP"} · active {timeAgo(s.updatedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={current}
                  onClick={() => revoke(s.token)}
                  className={cn("flex-none", !current && "text-muted-foreground hover:text-destructive")}
                >
                  {current ? "Current" : "Revoke"}
                </Button>
              </div>
            )
          })}
        </div>
      </SettingSection>
    </SettingsPage>
  )
}
