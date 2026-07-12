"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import type { BlockType, GuideBlockInput } from "@workspace/contracts/guide"
import { ArrowLeft, ImagePlus, Loader2, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { AddBlockMenu } from "@/components/add-block-menu"
import { BlockView, withStepNumbers } from "@/components/block-view"
import { useSetNavbar } from "@/components/navbar-context"
import { RichTextEditor } from "@/components/rich-text-editor"
import { authClient } from "@/lib/auth-client"
import {
  useGuide,
  useUpdateGuide,
  uploadStepMedia,
  type ClickRect,
} from "@/lib/guides"

/** Client-side editable block (has a stable key; `id` present if persisted). */
type EditBlock = {
  key: string
  id?: string
  type: BlockType
  content: string
  screenshotKey: string | null
  screenshotUrl: string | null
  elementLabel: string | null
  url: string | null
  clickRect: ClickRect | null
  confidence: number | null
}

const NEW_CONTENT: Record<BlockType, string> = {
  STEP: "<p>New step</p>",
  HEADING: "<p>New heading</p>",
  TIP: "<p>Add a tip</p>",
  ALERT: "<p>Add an alert</p>",
  OUTCOME: "<p>The result appears</p>",
}

export default function GuideEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const viewHref = `/guides/${params.id}`

  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: guide, isPending } = useGuide(activeWorkspace?.id, params.id)
  const updateGuide = useUpdateGuide(params.id)

  const [title, setTitle] = React.useState("")
  const [summary, setSummary] = React.useState<string | null>(null)
  const [blocks, setBlocks] = React.useState<EditBlock[]>([])
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [uploadingKey, setUploadingKey] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const mediaTargetKey = React.useRef<string | null>(null)
  const initialized = React.useRef(false)

  // Seed local state once when the guide loads.
  React.useEffect(() => {
    if (guide && !initialized.current) {
      initialized.current = true
      setTitle(guide.title)
      setSummary(guide.summary)
      setBlocks(
        guide.blocks.map((b) => ({
          key: crypto.randomUUID(),
          id: b.id,
          type: b.type,
          content: b.content,
          screenshotKey: b.screenshotKey,
          screenshotUrl: b.screenshotUrl,
          elementLabel: b.elementLabel,
          url: b.url,
          clickRect: b.clickRect,
          confidence: b.confidence,
        }))
      )
    }
  }, [guide])

  // Ref mirror so the (stable) navbar handlers always see fresh state and
  // the current mutation — without putting changing identities in deps,
  // which would re-inject the navbar every render (infinite loop).
  const latest = React.useRef({
    title,
    summary,
    blocks,
    dirty,
    save: updateGuide.mutateAsync,
  })
  React.useEffect(() => {
    latest.current = {
      title,
      summary,
      blocks,
      dirty,
      save: updateGuide.mutateAsync,
    }
  })

  const markDirty = () => setDirty(true)

  // Stable handlers ([] deps) — read everything from the ref.
  const handleSave = React.useCallback(async () => {
    const { title, summary, blocks, save } = latest.current
    const payload: {
      title: string
      summary: string | null
      blocks: GuideBlockInput[]
    } = {
      title: title.trim() || "Untitled guide",
      summary,
      blocks: blocks.map((b) => ({
        id: b.id,
        type: b.type,
        content: b.content,
        screenshotKey: b.screenshotKey,
        elementLabel: b.elementLabel,
        url: b.url,
        clickRect: b.clickRect,
      })),
    }
    await save(payload)
    setDirty(false)
    router.push(viewHref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBack = React.useCallback(() => {
    if (latest.current.dirty) setConfirmOpen(true)
    else router.push(viewHref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saving = updateGuide.isPending
  // Deps are primitives only (saving) → injected once + on save state change.
  useSetNavbar(
    {
      minimal: true,
      leftActions: (
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
      ),
      actions: (
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      ),
    },
    [handleBack, handleSave, saving]
  )

  // ── Block operations ─────────────────────────────────────────────────
  function insertBlock(index: number, type: BlockType) {
    const block: EditBlock = {
      key: crypto.randomUUID(),
      type,
      content: NEW_CONTENT[type],
      screenshotKey: null,
      screenshotUrl: null,
      elementLabel: null,
      url: null,
      clickRect: null,
      confidence: null,
    }
    setBlocks((prev) => [
      ...prev.slice(0, index),
      block,
      ...prev.slice(index),
    ])
    setEditingKey(block.key)
    markDirty()
  }

  function updateContent(key: string, content: string) {
    setBlocks((prev) =>
      prev.map((b) => (b.key === key ? { ...b, content } : b))
    )
    setEditingKey(null)
    markDirty()
  }

  function deleteBlock(key: string) {
    setBlocks((prev) => prev.filter((b) => b.key !== key))
    markDirty()
  }

  function pickMedia(key: string) {
    mediaTargetKey.current = key
    fileInputRef.current?.click()
  }

  async function onMediaSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const key = mediaTargetKey.current
    e.target.value = "" // allow re-selecting the same file
    if (!file || !key) return
    setUploadingKey(key)
    try {
      const objectKey = await uploadStepMedia(params.id, file)
      const previewUrl = URL.createObjectURL(file)
      setBlocks((prev) =>
        prev.map((b) =>
          b.key === key
            ? { ...b, screenshotKey: objectKey, screenshotUrl: previewUrl }
            : b
        )
      )
      markDirty()
    } finally {
      setUploadingKey(null)
    }
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="mt-8 h-24 w-full" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    )
  }

  const numbered = withStepNumbers(blocks)

  return (
    <div className="mx-auto max-w-2xl pb-24">
      {/* Editable title — auto-grows so long headings wrap and show fully */}
      <textarea
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          markDirty()
        }}
        rows={1}
        placeholder="Untitled guide"
        className="placeholder:text-muted-foreground/40 w-full resize-none bg-transparent font-serif text-4xl leading-tight font-medium tracking-tight outline-none [field-sizing:content]"
      />

      {/* Editable subheading / description */}
      <textarea
        value={summary ?? ""}
        onChange={(e) => {
          setSummary(e.target.value || null)
          markDirty()
        }}
        rows={1}
        placeholder="Add a description (optional)"
        className="placeholder:text-muted-foreground/40 text-muted-foreground mt-3 w-full resize-none bg-transparent text-lg leading-relaxed outline-none [field-sizing:content]"
      />

      <div className="mt-10">
        <AddBlockMenu onAdd={(type) => insertBlock(0, type)} />
        {numbered.map((block, index) => (
          <React.Fragment key={block.key}>
            <EditableBlock
              block={block}
              stepNumber={block.stepNumber}
              editing={editingKey === block.key}
              uploading={uploadingKey === block.key}
              onStartEdit={() => setEditingKey(block.key)}
              onSaveContent={(html) => updateContent(block.key, html)}
              onCancelEdit={() => setEditingKey(null)}
              onDelete={() => deleteBlock(block.key)}
              onAddMedia={() => pickMedia(block.key)}
            />
            <AddBlockMenu onAdd={(type) => insertBlock(index + 1, type)} />
          </React.Fragment>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onMediaSelected}
      />

      {/* Discard-changes confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium tracking-tight">
              Discard changes?
            </DialogTitle>
            <DialogDescription>
              You have unsaved edits. Leaving now will lose them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => router.push(viewHref)}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditableBlock({
  block,
  stepNumber,
  editing,
  uploading,
  onStartEdit,
  onSaveContent,
  onCancelEdit,
  onDelete,
  onAddMedia,
}: {
  block: EditBlock & { stepNumber?: number }
  stepNumber?: number
  editing: boolean
  uploading: boolean
  onStartEdit: () => void
  onSaveContent: (html: string) => void
  onCancelEdit: () => void
  onDelete: () => void
  onAddMedia: () => void
}) {
  return (
    <div className="group relative rounded-xl border border-transparent px-4 py-4 transition-colors hover:border-border">
      {/* Controls */}
      {!editing && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {block.type === "STEP" && (
            <button
              aria-label="Add media"
              onClick={onAddMedia}
              disabled={uploading}
              className="hover:bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-md"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
            </button>
          )}
          <button
            aria-label="Delete block"
            onClick={onDelete}
            className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex size-7 items-center justify-center rounded-md"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}

      {editing ? (
        <RichTextEditor
          initialHtml={block.content}
          onSave={onSaveContent}
          onCancel={onCancelEdit}
        />
      ) : (
        <div
          onClick={onStartEdit}
          className={cn("cursor-text rounded-lg")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") onStartEdit()
          }}
        >
          <BlockView block={block} stepNumber={stepNumber} />
        </div>
      )}
    </div>
  )
}
