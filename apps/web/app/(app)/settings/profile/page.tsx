"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { toast } from "sonner"

import { profileSchema } from "@workspace/contracts/settings"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { SettingSection, SettingsPage } from "@/components/settings/setting-section"
import { ImageUpload } from "@/components/settings/image-upload"
import { SectionSkeleton } from "@/components/settings/section-skeleton"
import { authClient } from "@/lib/auth-client"
import { initialOf } from "@/lib/settings"

export default function ProfilePage() {
  const { data: session, isPending, refetch } = authClient.useSession()
  const user = session?.user

  const [name, setName] = React.useState("")
  const [image, setImage] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (user) {
      setName(user.name)
      setImage(user.image ?? null)
    }
  }, [user])

  if (isPending || !user) return <SectionSkeleton rows={2} />

  const dirty = name.trim() !== user.name

  async function saveName() {
    const parsed = profileSchema.safeParse({ name })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the name")
      return
    }
    setSaving(true)
    const { error } = await authClient.updateUser({ name: parsed.data.name })
    setSaving(false)
    if (error) {
      toast.error(error.message ?? "Couldn't save")
      return
    }
    toast.success("Profile updated")
    refetch()
  }

  // Avatar updates optimistically (the preview + rail reflect immediately), then
  // persists; on failure we roll back to the previous image.
  async function changeImage(url: string | null) {
    const prev = image
    setImage(url)
    const { error } = await authClient.updateUser({ image: url ?? "" })
    if (error) {
      setImage(prev)
      toast.error(error.message ?? "Couldn't update photo")
      return
    }
    refetch()
  }

  return (
    <SettingsPage>
      <SettingSection
        title="Photo"
        description="Shown on your profile and across your workspaces."
      >
        <ImageUpload
          value={image}
          onChange={changeImage}
          kind="avatar"
          shape="circle"
          fallback={<span className="text-lg font-semibold">{initialOf(user)}</span>}
        />
      </SettingSection>

      <SettingSection
        title="Name"
        description="Your display name, visible to workspace members."
        actions={
          <Button size="sm" onClick={saveName} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && dirty && !saving) saveName()
          }}
          maxLength={50}
          className="max-w-sm"
          aria-label="Display name"
        />
      </SettingSection>

      <SettingSection
        title="Email"
        description="Used to sign in. Changing your email is coming soon."
      >
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-sm text-foreground">{user.email}</span>
          {user.emailVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--l-success)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--l-success)]">
              <Check className="size-3" strokeWidth={3} /> Verified
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Unverified
            </span>
          )}
        </div>
      </SettingSection>
    </SettingsPage>
  )
}
