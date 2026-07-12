"use client"

import * as React from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Files,
  ImagePlus,
  Images,
  Loader2,
  Search,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import type { BlockType } from "@workspace/contracts/guide"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { authClient } from "@/lib/auth-client"
import { api } from "@/lib/api"
import {
  useGuides,
  uploadStepMedia,
  type ClickRect,
  type GuideDetail,
} from "@/lib/guides"

/** A staged block produced by an import — matches the editor's block shape. */
export type ImportedBlock = {
  type: BlockType
  content: string
  screenshotKey: string | null
  screenshotUrl: string | null
  elementLabel: string | null
  url: string | null
  clickRect: ClickRect | null
}

type View = "picker" | "guides" | "steps" | "screenshots" | "docx" | "pdf"

const TYPE_LABEL: Record<Exclude<BlockType, "STEP">, string> = {
  HEADING: "Heading",
  TIP: "Tip",
  ALERT: "Alert",
  OUTCOME: "Outcome",
}

/** Plain-text preview of a block's HTML content. */
function preview(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return text || "Untitled"
}

/**
 * Import Steps — a source picker that drills into each source. Imported blocks
 * are staged into the editor's working copy and only reach the published guide
 * when the editor clicks Save.
 */
export function ImportStepsDialog({
  currentGuideId,
  onImport,
  open,
  onOpenChange,
}: {
  currentGuideId: string
  onImport: (blocks: ImportedBlock[]) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [view, setView] = React.useState<View>("picker")
  const [picked, setPicked] = React.useState<{
    title: string
    blocks: ImportedBlock[]
  } | null>(null)

  React.useEffect(() => {
    if (open) {
      setView("picker")
      setPicked(null)
    }
  }, [open])

  function finish(blocks: ImportedBlock[]) {
    if (blocks.length === 0) return
    onImport(blocks)
    toast.success(
      `Imported ${blocks.length} ${blocks.length === 1 ? "step" : "steps"}`
    )
    onOpenChange(false)
  }

  const header: Record<View, { title: string; desc: string; back?: View }> = {
    picker: {
      title: "Import Steps",
      desc: "Choose a source to import steps into your guide",
    },
    guides: {
      title: "Import from other guides",
      desc: "Pick a guide, then choose the steps",
      back: "picker",
    },
    steps: {
      title: picked?.title ?? "Select steps",
      desc: "Select the steps to import",
      back: "guides",
    },
    screenshots: {
      title: "Import screenshots",
      desc: "Upload multiple screenshots at once",
      back: "picker",
    },
    docx: {
      title: "Import from DOCX",
      desc: "We'll read the document and turn it into steps",
      back: "picker",
    },
    pdf: {
      title: "Import from PDF",
      desc: "We'll read the document and turn it into steps",
      back: "picker",
    },
  }
  const h = header[view]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 border-b px-6 py-4">
          {h.back && (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Back"
              onClick={() => setView(h.back!)}
            >
              <ChevronLeft className="size-4" />
            </Button>
          )}
          <div className="min-w-0">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {h.title}
            </DialogTitle>
            <DialogDescription>{h.desc}</DialogDescription>
          </div>
        </DialogHeader>

        {view === "picker" && (
          <SourcePicker
            onGuides={() => setView("guides")}
            onScreenshots={() => setView("screenshots")}
            onDocx={() => setView("docx")}
            onPdf={() => setView("pdf")}
          />
        )}
        {view === "guides" && (
          <GuideList
            currentGuideId={currentGuideId}
            onLoaded={(title, blocks) => {
              setPicked({ title, blocks })
              setView("steps")
            }}
          />
        )}
        {view === "steps" && picked && (
          <StepPicker blocks={picked.blocks} onImport={finish} />
        )}
        {view === "screenshots" && (
          <FromScreenshots guideId={currentGuideId} onDone={finish} />
        )}
        {(view === "docx" || view === "pdf") && (
          <FromDocument
            guideId={currentGuideId}
            kind={view}
            onDone={finish}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ── source picker ───────────────────────────────────────────────────────── */

function SourcePicker({
  onGuides,
  onScreenshots,
  onDocx,
  onPdf,
}: {
  onGuides: () => void
  onScreenshots: () => void
  onDocx: () => void
  onPdf: () => void
}) {
  return (
    <div className="space-y-2.5 p-6">
      <SourceCard
        tint="bg-primary/10 text-primary"
        icon={<Files className="size-6" />}
        title="Import from other guides"
        desc="Copy steps from your existing guides"
        onClick={onGuides}
      />
      <SourceCard
        tint="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        icon={<Images className="size-6" />}
        title="Import Screenshots"
        desc="Upload multiple screenshots at once"
        onClick={onScreenshots}
      />
      <SourceCard
        tint="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        icon={<FileText className="size-6" />}
        title="Import from DOCX"
        badge
        desc="Import steps from a Word document"
        onClick={onDocx}
      />
      <SourceCard
        tint="bg-rose-500/10 text-rose-600 dark:text-rose-400"
        icon={<FileText className="size-6" />}
        title="Import from PDF"
        badge
        desc="Import steps from a PDF file"
        onClick={onPdf}
      />
    </div>
  )
}

function SourceCard({
  tint,
  icon,
  title,
  desc,
  badge,
  onClick,
}: {
  tint: string
  icon: React.ReactNode
  title: string
  desc: string
  badge?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="hover:border-primary/60 hover:bg-muted/30 group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors"
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl",
          tint
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium">
          {title}
          {badge && <Zap className="size-3.5 fill-amber-400 text-amber-400" />}
        </p>
        <p className="text-muted-foreground text-sm">{desc}</p>
      </div>
      <ChevronRight className="text-muted-foreground/50 group-hover:text-muted-foreground size-5 shrink-0 transition-colors" />
    </button>
  )
}

/* ── from another guide ──────────────────────────────────────────────────── */

function GuideList({
  currentGuideId,
  onLoaded,
}: {
  currentGuideId: string
  onLoaded: (title: string, blocks: ImportedBlock[]) => void
}) {
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: guides, isPending } = useGuides(activeWorkspace?.id)
  const [query, setQuery] = React.useState("")
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const list = (guides ?? [])
    .filter((g) => g.id !== currentGuideId)
    .filter((g) => g.title.toLowerCase().includes(query.toLowerCase()))

  async function openGuide(id: string, title: string) {
    setBusyId(id)
    try {
      const { data } = await api.get<{ guide: GuideDetail }>(`/guides/${id}`)
      const blocks: ImportedBlock[] = data.guide.blocks.map((b) => ({
        type: b.type,
        content: b.content,
        // Reuse the source's R2 key — the object is shared, not copied.
        screenshotKey: b.screenshotKey,
        screenshotUrl: b.screenshotUrl,
        elementLabel: b.elementLabel,
        url: b.url,
        clickRect: b.clickRect,
      }))
      onLoaded(title, blocks)
    } catch {
      toast.error("Couldn't open that guide")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="relative mb-3">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search guides…"
          className="pl-9"
        />
      </div>

      {isPending ? (
        <p className="text-muted-foreground py-8 text-center text-sm">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No other guides to import from.
        </p>
      ) : (
        <div className="space-y-1">
          {list.map((g) => (
            <button
              key={g.id}
              onClick={() => openGuide(g.id, g.title)}
              disabled={!!busyId}
              className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors disabled:opacity-50"
            >
              {g.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={g.coverUrl}
                  alt=""
                  className="bg-muted h-9 w-14 shrink-0 rounded border object-cover"
                />
              ) : (
                <div className="bg-muted h-9 w-14 shrink-0 rounded border" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{g.title}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  {g.stepCount} steps
                </p>
              </div>
              {busyId === g.id ? (
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              ) : (
                <ChevronRight className="text-muted-foreground/50 size-4" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Multiselect list of a guide's blocks — import the chosen ones. */
function StepPicker({
  blocks,
  onImport,
}: {
  blocks: ImportedBlock[]
  onImport: (blocks: ImportedBlock[]) => void
}) {
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const allSelected = selected.size === blocks.length && blocks.length > 0

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(blocks.map((_, i) => i)))
  }

  // Running step number for STEP blocks.
  let stepNo = 0
  const numbered = blocks.map((b) => ({
    b,
    n: b.type === "STEP" ? ++stepNo : null,
  }))

  return (
    <>
      <div className="flex items-center justify-between border-b px-6 py-2.5">
        <span className="text-muted-foreground text-xs">
          {selected.size} of {blocks.length} selected
        </span>
        <Button variant="ghost" size="sm" onClick={toggleAll}>
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {numbered.map(({ b, n }, i) => {
          const isSelected = selected.has(i)
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                isSelected
                  ? "border-primary/60 bg-primary/5"
                  : "hover:bg-muted/60 border-transparent"
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded border",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-input"
                )}
              >
                {isSelected && <Check className="size-3.5" />}
              </span>
              {n !== null ? (
                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium tabular-nums">
                  {n}
                </span>
              ) : (
                <span className="text-muted-foreground bg-muted flex h-6 shrink-0 items-center rounded-full px-2 font-mono text-[10px] tracking-wide uppercase">
                  {TYPE_LABEL[b.type as Exclude<BlockType, "STEP">]}
                </span>
              )}
              {b.screenshotUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.screenshotUrl}
                  alt=""
                  className="bg-muted h-9 w-14 shrink-0 rounded border object-cover"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">
                {preview(b.content)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
        <Button
          onClick={() => onImport(blocks.filter((_, i) => selected.has(i)))}
          disabled={selected.size === 0}
        >
          Import {selected.size > 0 ? selected.size : ""}{" "}
          {selected.size === 1 ? "step" : "steps"}
        </Button>
      </div>
    </>
  )
}

/* ── from screenshots ────────────────────────────────────────────────────── */

function FromScreenshots({
  guideId,
  onDone,
}: {
  guideId: string
  onDone: (blocks: ImportedBlock[]) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [progress, setProgress] = React.useState<{ done: number; total: number }>(
    { done: 0, total: 0 }
  )

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (files.length === 0) return
    setUploading(true)
    setProgress({ done: 0, total: files.length })
    const blocks: ImportedBlock[] = []
    try {
      for (const file of files) {
        const key = await uploadStepMedia(guideId, file)
        blocks.push({
          type: "STEP",
          content: "<p>New step</p>",
          screenshotKey: key,
          screenshotUrl: URL.createObjectURL(file),
          elementLabel: null,
          url: null,
          clickRect: null,
        })
        setProgress((p) => ({ ...p, done: p.done + 1 }))
      }
      onDone(blocks)
    } catch {
      toast.error("Couldn't upload one of the images")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="border-border hover:border-primary/50 hover:bg-muted/40 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center transition-colors disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
            <p className="text-sm">
              Uploading {progress.done} / {progress.total}…
            </p>
          </>
        ) : (
          <>
            <ImagePlus className="text-muted-foreground size-6" />
            <p className="text-sm font-medium">Choose screenshots</p>
            <p className="text-muted-foreground text-xs">
              PNG, JPG, WebP or GIF — one step per image
            </p>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={onFiles}
      />
    </div>
  )
}

/** Upload a DOCX/PDF; the server extracts text and the AI structures steps. */
function FromDocument({
  guideId,
  kind,
  onDone,
}: {
  guideId: string
  kind: "docx" | "pdf"
  onDone: (blocks: ImportedBlock[]) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const accept =
    kind === "docx"
      ? ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : ".pdf,application/pdf"

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBusy(true)
    try {
      const { data } = await api.post<{
        blocks: { type: BlockType; content: string }[]
      }>(`/guides/${guideId}/import-document?kind=${kind}`, file, {
        headers: { "Content-Type": file.type || "application/octet-stream" },
      })
      const blocks: ImportedBlock[] = data.blocks.map((b) => ({
        type: b.type,
        content: b.content,
        screenshotKey: null,
        screenshotUrl: null,
        elementLabel: null,
        url: null,
        clickRect: null,
      }))
      if (blocks.length === 0) {
        toast.error("No steps found in that document")
        return
      }
      onDone(blocks)
    } catch {
      toast.error("Couldn't import that document")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="border-border hover:border-primary/50 hover:bg-muted/40 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center transition-colors disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
            <p className="text-sm">Reading the document…</p>
            <p className="text-muted-foreground text-xs">
              This can take a few seconds
            </p>
          </>
        ) : (
          <>
            <FileText className="text-muted-foreground size-6" />
            <p className="text-sm font-medium">
              Choose a {kind.toUpperCase()} file
            </p>
            <p className="text-muted-foreground text-xs">
              We&apos;ll turn its procedure into steps
            </p>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onFile}
      />
    </div>
  )
}
