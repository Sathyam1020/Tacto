"use client"

import * as React from "react"
import {
  Check,
  FileText,
  File as FileIcon,
  GripVertical,
  LayoutGrid,
  Link2,
  ListChecks,
  Loader2,
  Plus,
  Rows3,
  Search,
  Trash2,
  Upload,
  Video,
} from "lucide-react"
import { toast } from "sonner"

import type { AddResourceInput, ShowcaseDetail, ShowcaseItemDetail, ShowcaseItemType, ShowcaseLayout } from "@workspace/contracts/showcase"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"

import { SettingSection, SettingsPage } from "@/components/settings/setting-section"
import { SettingRow, SettingRows } from "@/components/settings/setting-row"
import { DangerAction, DangerZone } from "@/components/settings/danger-zone"
import { ConfirmDialog } from "@/components/settings/confirm-dialog"
import { ImageUpload } from "@/components/settings/image-upload"
import { LogoMark } from "@workspace/ui/components/logo"
import { authClient } from "@/lib/auth-client"
import { useForms } from "@/lib/forms"
import {
  uploadAsset,
  useAddGuides,
  useAddResource,
  useAvailableGuides,
  useCreateSection,
  useDeleteItem,
  useDeleteSection,
  useDeleteShowcase,
  useUpdateSection,
  useUpdateShowcase,
} from "@/lib/showcase"

const ITEM_ICON: Record<ShowcaseItemType, React.ComponentType<{ className?: string }>> = {
  guide: FileText,
  video: Video,
  pdf: FileIcon,
  link: Link2,
  form: FileText,
}

function itemLabel(item: ShowcaseItemDetail): string {
  return item.title || item.guide?.title || (item.type === "link" ? item.url ?? "Link" : item.type.toUpperCase())
}

/* ── Content ─────────────────────────────────────────────────────────────── */
export function ContentSurface({ sc }: { sc: ShowcaseDetail }) {
  const createSection = useCreateSection(sc.id)
  return (
    <div className="flex flex-col gap-4">
      {sc.sections.map((section) => (
        <SectionCard key={section.id} scId={sc.id} section={section} />
      ))}
      <button
        onClick={() => createSection.mutate("New section")}
        disabled={createSection.isPending}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--l-hairline-strong)] py-3 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="size-4" /> Add section
      </button>
    </div>
  )
}

function SectionCard({ scId, section }: { scId: string; section: ShowcaseDetail["sections"][number] }) {
  const update = useUpdateSection(scId)
  const del = useDeleteSection(scId)
  const delItem = useDeleteItem(scId)
  const [editing, setEditing] = React.useState(false)

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--l-hairline)]">
      <div className="flex items-center gap-2 border-b border-[var(--l-hairline)] bg-[var(--l-chrome)] px-3 py-2">
        {editing ? (
          <input
            autoFocus
            defaultValue={section.title}
            onBlur={(e) => {
              setEditing(false)
              const t = e.target.value.trim()
              if (t && t !== section.title) update.mutate({ sid: section.id, title: t })
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
              if (e.key === "Escape") setEditing(false)
            }}
            className="flex-1 rounded-md border border-primary bg-[var(--l-card)] px-2 py-1 text-[13px] outline-none"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">
            {section.title}
          </button>
        )}
        <button
          onClick={() => update.mutate({ sid: section.id, hidden: !section.hidden })}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {section.hidden ? "Hidden" : "Visible"}
        </button>
        <button
          onClick={() => del.mutate(section.id)}
          aria-label="Delete section"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {section.items.length > 0 && (
        <ul className="divide-y divide-[var(--l-hairline)]">
          {section.items.map((item) => {
            const Icon = ITEM_ICON[item.type]
            return (
              <li key={item.id} className="group flex items-center gap-2.5 px-3 py-2.5">
                <GripVertical className="size-4 flex-none text-muted-foreground/40" />
                <span className="flex size-7 flex-none items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{itemLabel(item)}</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase">{item.type}</span>
                <button
                  onClick={() => delItem.mutate(item.id)}
                  aria-label="Remove item"
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="border-t border-[var(--l-hairline)] p-2">
        <AddItemMenu scId={scId} sid={section.id} />
      </div>
    </div>
  )
}

function AddItemMenu({ scId, sid }: { scId: string; sid: string }) {
  const [open, setOpen] = React.useState<null | "guides" | "video" | "pdf" | "link" | "form">(null)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[var(--l-hover)] hover:text-foreground">
          <Plus className="size-4" /> Add item
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={() => setOpen("guides")}>
            <FileText className="size-4" /> Guides
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen("video")}>
            <Video className="size-4" /> Video
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("pdf")}>
            <FileIcon className="size-4" /> PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("link")}>
            <Link2 className="size-4" /> Link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("form")}>
            <FileText className="size-4" /> Form
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {open === "guides" && <GuidePickerDialog scId={scId} sid={sid} onClose={() => setOpen(null)} />}
      {open && open !== "guides" && (
        <ResourceDialog scId={scId} sid={sid} kind={open} onClose={() => setOpen(null)} />
      )}
    </>
  )
}

function GuidePickerDialog({ scId, sid, onClose }: { scId: string; sid: string; onClose: () => void }) {
  const [q, setQ] = React.useState("")
  const { data: guides, isPending } = useAvailableGuides(scId, q, true)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const add = useAddGuides(scId)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add guides</DialogTitle>
          <DialogDescription>Published guides in this workspace.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--l-hairline)] px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guides…"
            className="h-10 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {isPending ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (guides ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No published guides found.</p>
          ) : (
            (guides ?? []).map((g) => (
              <button
                key={g.id}
                onClick={() => toggle(g.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--l-hover)]"
              >
                <span
                  className={cn(
                    "flex size-5 flex-none items-center justify-center rounded-md border",
                    selected.has(g.id) ? "border-primary bg-primary text-primary-foreground" : "border-[var(--l-hairline-strong)]"
                  )}
                >
                  {selected.has(g.id) && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{g.title}</span>
                <span className="text-xs text-muted-foreground">{g.stepCount} steps</span>
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={selected.size === 0 || add.isPending}
            onClick={() =>
              add.mutate(
                { sid, guideIds: [...selected] },
                { onSuccess: onClose, onError: () => toast.error("Couldn't add guides") }
              )
            }
          >
            {add.isPending ? "Adding…" : `Add ${selected.size || ""}`.trim()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ResourceDialog({
  scId,
  sid,
  kind,
  onClose,
}: {
  scId: string
  sid: string
  kind: "video" | "pdf" | "link" | "form"
  onClose: () => void
}) {
  const add = useAddResource(scId)
  const { data: ws } = authClient.useActiveOrganization()
  const { data: forms } = useForms(ws?.id)
  const publishedForms = (forms ?? []).filter((f) => f.status === "PUBLISHED" && f.shareId)

  const [url, setUrl] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [formShareId, setFormShareId] = React.useState("")
  const [uploading, setUploading] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const canUpload = kind === "video" || kind === "pdf"
  const accept = kind === "video" ? "video/mp4,video/webm" : "application/pdf"

  async function onFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      setUrl(await uploadAsset(file))
      toast.success("Uploaded")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function submit() {
    let input: AddResourceInput
    if (kind === "form") {
      if (!formShareId) return toast.error("Pick a form")
      input = { type: "form", formShareId, title: title || undefined }
    } else {
      if (!url) return toast.error("Add a URL")
      input = { type: kind, url, title: title || undefined }
    }
    add.mutate({ sid, input }, { onSuccess: onClose, onError: () => toast.error("Couldn't add the item") })
  }

  const heading = { video: "Add video", pdf: "Add PDF", link: "Add link", form: "Add form" }[kind]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {kind === "form" ? (
            <div>
              <p className="mb-1.5 text-[13px] font-medium">Form</p>
              {publishedForms.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Publish a form first to add it here.</p>
              ) : (
                <div className="max-h-48 divide-y divide-[var(--l-hairline)] overflow-y-auto rounded-lg border border-[var(--l-hairline)]">
                  {publishedForms.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFormShareId(f.shareId!)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--l-hover)]",
                        formShareId === f.shareId && "bg-primary/5"
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{f.title}</span>
                      {formShareId === f.shareId && <Check className="size-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-[13px] font-medium">
                {kind === "link" ? "URL" : `${kind === "video" ? "Video" : "PDF"} URL`}
              </p>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={kind === "video" ? "YouTube / Loom / .mp4 URL" : "https://…"}
                autoFocus
              />
              {canUpload && (
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    or upload
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={(e) => {
                      void onFile(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                </div>
              )}
            </div>
          )}
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Label (optional)</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Display title" maxLength={120} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={add.isPending || uploading}>
            {add.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Design ──────────────────────────────────────────────────────────────── */
const LAYOUTS: { value: ShowcaseLayout; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { value: "SECTION", label: "Section", icon: Rows3, hint: "Sidebar + content, docs-style" },
  { value: "CHECKLIST", label: "Checklist", icon: ListChecks, hint: "Sequential, tracks progress" },
  { value: "GALLERY", label: "Gallery", icon: LayoutGrid, hint: "Browsable thumbnail grid" },
]
const SWATCHES = ["#5e6ad2", "#0e7c5b", "#dc2626", "#b7791f", "#2563eb", "#7c3aed", "#0891b2", "#16171b"]

export function DesignSurface({ sc }: { sc: ShowcaseDetail }) {
  const update = useUpdateShowcase(sc.id)
  return (
    <SettingsPage>
      <SettingSection title="Layout" description="How visitors move through the showcase.">
        <div className="grid max-w-lg grid-cols-3 gap-3">
          {LAYOUTS.map(({ value, label, icon: Icon, hint }) => {
            const active = sc.layout === value
            return (
              <button
                key={value}
                onClick={() => update.mutate({ layout: value })}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors",
                  active ? "border-primary bg-primary/5" : "border-[var(--l-hairline)] hover:border-primary/40"
                )}
              >
                <span className={cn("flex size-9 items-center justify-center rounded-lg", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  <Icon className="size-4" />
                </span>
                <span className="text-[13px] font-medium">{label}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{hint}</span>
              </button>
            )
          })}
        </div>
      </SettingSection>

      <SettingSection title="Behavior">
        <SettingRows>
          <SettingRow label="Autoplay" description="Advance to the next item on completion.">
            <Switch checked={sc.autoplay} onCheckedChange={(v) => update.mutate({ autoplay: v })} />
          </SettingRow>
        </SettingRows>
      </SettingSection>

      <SettingSection title="Brand color" description="Accent for the public page.">
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => update.mutate({ brandColor: c })}
              style={{ background: c }}
              className={cn(
                "size-8 rounded-lg ring-2 ring-offset-2 ring-offset-[var(--l-content-a)] transition-transform hover:scale-110",
                sc.brandColor === c ? "ring-foreground" : "ring-transparent"
              )}
              aria-label={`Brand color ${c}`}
            />
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Logo" description="Shown in the showcase header.">
        <ImageUpload
          value={sc.logoUrl}
          onChange={(url) => update.mutate({ logoUrl: url })}
          kind="logo"
          shape="square"
          fallback={<LogoMark className="size-6" />}
        />
      </SettingSection>
    </SettingsPage>
  )
}

/* ── Settings ────────────────────────────────────────────────────────────── */
export function SettingsSurface({ sc, onDeleted }: { sc: ShowcaseDetail; onDeleted: () => void }) {
  const update = useUpdateShowcase(sc.id)
  const [title, setTitle] = React.useState(sc.title)
  const [slug, setSlug] = React.useState(sc.slug)
  React.useEffect(() => {
    setTitle(sc.title)
    setSlug(sc.slug)
  }, [sc.title, sc.slug])

  return (
    <SettingsPage>
      <SettingSection
        title="Name"
        actions={
          <Button size="sm" disabled={update.isPending || title.trim() === sc.title} onClick={() => update.mutate({ title: title.trim() })}>
            Save
          </Button>
        }
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="max-w-sm" />
      </SettingSection>

      <SettingSection
        title="Address"
        description="Public URL. Lowercase letters, numbers, and dashes."
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending || slug.trim() === sc.slug}
            onClick={() =>
              update.mutate(
                { slug: slug.trim() },
                { onError: () => toast.error("That address is taken") }
              )
            }
          >
            Save
          </Button>
        }
      >
        <div className="flex max-w-sm items-center gap-1.5">
          <span className="text-[13px] text-muted-foreground">tacto.so/showcase/</span>
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={48} className="flex-1 font-mono" />
        </div>
      </SettingSection>

      <SettingSection title="Visibility" description="Unlisted showcases are reachable by link but not indexed.">
        <SettingRows>
          <SettingRow label="Listed" description="Allow search engines to index it once published.">
            <Switch checked={sc.listed} onCheckedChange={(v) => update.mutate({ listed: v })} />
          </SettingRow>
        </SettingRows>
      </SettingSection>

      <DeleteShowcase id={sc.id} title={sc.title} onDeleted={onDeleted} />
    </SettingsPage>
  )
}

function DeleteShowcase({ id, title, onDeleted }: { id: string; title: string; onDeleted: () => void }) {
  const [open, setOpen] = React.useState(false)
  const del = useDeleteShowcase()
  return (
    <DangerZone>
      <DangerAction
        title="Delete showcase"
        description="Permanently delete this showcase and its sections. Guides and forms are not affected."
        action={
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
            Delete
          </Button>
        }
      />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${title}?`}
        description="This permanently deletes the showcase. The guides and forms it references stay intact."
        confirmLabel="Delete showcase"
        confirmText={title}
        onConfirm={async () => {
          await del.mutateAsync(id)
          onDeleted()
        }}
      />
    </DangerZone>
  )
}
