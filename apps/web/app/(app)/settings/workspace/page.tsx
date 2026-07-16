"use client"

import * as React from "react"
import { toast } from "sonner"

import { workspaceNameSchema, workspaceSlugSchema } from "@workspace/contracts/settings"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { LogoMark } from "@workspace/ui/components/logo"

import { SettingSection, SettingsPage } from "@/components/settings/setting-section"
import { ImageUpload } from "@/components/settings/image-upload"
import { SectionSkeleton } from "@/components/settings/section-skeleton"
import { authClient } from "@/lib/auth-client"
import { asRole, can } from "@/lib/permissions"

type Member = { userId?: string; role?: string }

export default function WorkspacePage() {
  const { data: session } = authClient.useSession()
  const { data: ws, isPending, refetch } = authClient.useActiveOrganization()

  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [logo, setLogo] = React.useState<string | null>(null)
  const [savingName, setSavingName] = React.useState(false)
  const [savingSlug, setSavingSlug] = React.useState(false)

  React.useEffect(() => {
    if (ws) {
      setName(ws.name)
      setSlug(ws.slug)
      setLogo(ws.logo ?? null)
    }
  }, [ws])

  if (isPending || !ws) return <SectionSkeleton rows={3} />

  const members = (ws.members ?? []) as Member[]
  const myRole = asRole(members.find((m) => m.userId === session?.user.id)?.role)
  const editable = can(myRole, "workspace:edit")

  async function saveName() {
    const parsed = workspaceNameSchema.safeParse(name)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the name")
      return
    }
    setSavingName(true)
    const { error } = await authClient.organization.update({
      organizationId: ws!.id,
      data: { name: parsed.data },
    })
    setSavingName(false)
    if (error) return toast.error(error.message ?? "Couldn't save")
    toast.success("Workspace updated")
    refetch()
  }

  async function saveSlug() {
    const parsed = workspaceSlugSchema.safeParse(slug)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the address")
      return
    }
    setSavingSlug(true)
    const { error } = await authClient.organization.update({
      organizationId: ws!.id,
      data: { slug: parsed.data },
    })
    setSavingSlug(false)
    if (error) return toast.error(error.message ?? "That address is taken")
    toast.success("Workspace address updated")
    refetch()
  }

  async function changeLogo(url: string | null) {
    const prev = logo
    setLogo(url)
    const { error } = await authClient.organization.update({
      organizationId: ws!.id,
      data: { logo: url ?? "" },
    })
    if (error) {
      setLogo(prev)
      toast.error(error.message ?? "Couldn't update logo")
      return
    }
    refetch()
  }

  return (
    <SettingsPage>
      {!editable && (
        <div className="mb-6 rounded-lg border border-[var(--l-hairline)] bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
          Only workspace admins can change these settings.
        </div>
      )}

      <SettingSection title="Logo" description="Represents your workspace across Tacto.">
        <ImageUpload
          value={logo}
          onChange={changeLogo}
          kind="logo"
          shape="square"
          disabled={!editable}
          fallback={<LogoMark className="size-6" />}
        />
      </SettingSection>

      <SettingSection
        title="Name"
        description="The display name for this workspace."
        actions={
          editable ? (
            <Button size="sm" onClick={saveName} disabled={savingName || name.trim() === ws.name}>
              {savingName ? "Saving…" : "Save"}
            </Button>
          ) : undefined
        }
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && editable && saveName()}
          disabled={!editable}
          maxLength={50}
          className="max-w-sm"
          aria-label="Workspace name"
        />
      </SettingSection>

      <SettingSection
        title="Workspace address"
        description="A unique identifier for your workspace. Lowercase letters, numbers, and dashes."
        actions={
          editable ? (
            <Button size="sm" variant="outline" onClick={saveSlug} disabled={savingSlug || slug.trim() === ws.slug}>
              {savingSlug ? "Saving…" : "Save"}
            </Button>
          ) : undefined
        }
      >
        <div className="flex max-w-sm items-center gap-1.5">
          <span className="text-[13px] text-muted-foreground">tacto.so/</span>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            disabled={!editable}
            maxLength={48}
            className="flex-1 font-mono"
            aria-label="Workspace address"
          />
        </div>
      </SettingSection>
    </SettingsPage>
  )
}
