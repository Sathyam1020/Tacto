"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { passwordChangeSchema } from "@workspace/contracts/settings"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { SettingSection, SettingsPage } from "@/components/settings/setting-section"
import { SettingRow, SettingRows } from "@/components/settings/setting-row"
import { SectionSkeleton } from "@/components/settings/section-skeleton"
import { authClient } from "@/lib/auth-client"

type LinkedAccount = { id: string; providerId: string; accountId: string }

function useAccounts() {
  return useQuery({
    queryKey: ["settings", "accounts"],
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts()
      if (error) throw new Error(error.message ?? "Couldn't load accounts")
      return (data ?? []) as LinkedAccount[]
    },
  })
}

export default function SecurityPage() {
  const { data: accounts, isPending, refetch } = useAccounts()

  if (isPending || !accounts) return <SectionSkeleton rows={2} />

  const hasPassword = accounts.some((a) => a.providerId === "credential")
  const google = accounts.find((a) => a.providerId === "google")

  return (
    <SettingsPage>
      {hasPassword ? (
        <PasswordSection />
      ) : (
        <SettingSection title="Password" description="You sign in with Google — no password to manage here.">
          <p className="text-[13px] text-muted-foreground">
            Password sign-in is not set up for this account.
          </p>
        </SettingSection>
      )}

      <SettingSection
        title="Connected accounts"
        description="Sign in faster by linking a social account."
      >
        <SettingRows>
          <SettingRow
            label="Google"
            description={google ? "Connected" : "Not connected"}
          >
            {google ? (
              <Button
                size="sm"
                variant="outline"
                disabled={!hasPassword && accounts.length <= 1}
                onClick={async () => {
                  const { error } = await authClient.unlinkAccount({ providerId: "google" })
                  if (error) toast.error(error.message ?? "Couldn't disconnect")
                  else {
                    toast.success("Google disconnected")
                    refetch()
                  }
                }}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  authClient.linkSocial({ provider: "google", callbackURL: "/settings/security" })
                }
              >
                Connect
              </Button>
            )}
          </SettingRow>
        </SettingRows>
        {google && !hasPassword && accounts.length <= 1 && (
          <p className="mt-3 text-[12px] text-muted-foreground">
            This is your only sign-in method — set a password before disconnecting.
          </p>
        )}
      </SettingSection>
    </SettingsPage>
  )
}

function PasswordSection() {
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: current,
      newPassword: next,
      confirmPassword: confirm,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the fields")
      return
    }
    setSaving(true)
    const { error } = await authClient.changePassword({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      revokeOtherSessions: true,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message ?? "Couldn't change password")
      return
    }
    toast.success("Password changed — other sessions signed out")
    setCurrent("")
    setNext("")
    setConfirm("")
  }

  return (
    <SettingSection
      title="Password"
      description="Changing your password signs out every other session."
    >
      <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          aria-label="Current password"
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-label="New password"
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-label="Confirm new password"
        />
        <div>
          <Button type="submit" size="sm" disabled={saving || !current || !next || !confirm}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Update password
          </Button>
        </div>
      </form>
    </SettingSection>
  )
}
