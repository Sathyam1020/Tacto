"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Palette,
  Plus,
  Redo2,
  Search,
  Settings2,
  Trash2,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"

import {
  resolveFormDesign,
  type FieldType,
  type FormDocument,
  type FormField,
} from "@workspace/contracts/form"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { DesignPanel } from "@/components/form-builder/design-panel"
import { FieldSettings } from "@/components/form-builder/field-settings"
import { FormFieldView } from "@/components/form-builder/form-field-view"
import { PublicFormView } from "@/components/public-form-view"
import { useSetNavbar } from "@/components/navbar-context"
import { authClient } from "@/lib/auth-client"
import {
  canRedo,
  canUndo,
  commit,
  amend,
  editCount,
  initHistory,
  redo,
  undo,
  type History,
} from "@/lib/editor-history"
import { FIELD_TYPES, FIELD_TYPE_ORDER, newField } from "@/lib/form-fields"
import { useForm, useFormDraft, usePublishForm, useSaveFormDraft } from "@/lib/forms"

const AUTOSAVE_MS = 1000
const COALESCE_MS = 600

type Selection =
  | { kind: "field"; key: string }
  | { kind: "design" }
  | { kind: "thankyou" }
  | { kind: "settings" }
type SaveState = "saved" | "saving" | "error" | "conflict"

export default function FormBuilderPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const draftQuery = useFormDraft(activeWorkspace?.id, params.id)
  const { data: form } = useForm(activeWorkspace?.id, params.id)
  const save = useSaveFormDraft(params.id)
  const publish = usePublishForm(params.id)

  const [history, setHistory] = React.useState<History<FormDocument> | null>(null)
  const [saveState, setSaveState] = React.useState<SaveState>("saved")
  const [selection, setSelection] = React.useState<Selection | null>(null)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  // Whether the draft is ahead of what's published — gates the Update button.
  // Seeded once from the server, then set true on any edit / false on publish.
  const [dirty, setDirty] = React.useState(false)
  const dirtySeeded = React.useRef(false)

  const doc = history?.present ?? null

  // Refs the autosave loop reads without re-subscribing.
  const versionRef = React.useRef(0)
  const presentRef = React.useRef<FormDocument | null>(null)
  const dirtyRef = React.useRef(false)
  const savingRef = React.useRef(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const coalesceRef = React.useRef<{ key: string; at: number } | null>(null)

  // Initialize once the server draft arrives.
  const inited = React.useRef(false)
  React.useEffect(() => {
    if (inited.current || !draftQuery.data) return
    inited.current = true
    const d = draftQuery.data
    setHistory(initHistory(d.document))
    presentRef.current = d.document
    versionRef.current = d.version
    if (d.document.fields[0]) setSelection({ kind: "field", key: d.document.fields[0].key })
  }, [draftQuery.data])

  // Seed the dirty flag once the form loads: a never-published form, or one
  // whose draft already diverges from the published doc, has changes to publish.
  React.useEffect(() => {
    if (dirtySeeded.current || !form) return
    dirtySeeded.current = true
    setDirty(form.status !== "PUBLISHED" || form.hasUnpublishedChanges)
  }, [form])

  const flush = React.useCallback(async () => {
    if (savingRef.current || !dirtyRef.current || !presentRef.current) return
    savingRef.current = true
    dirtyRef.current = false
    setSaveState("saving")
    try {
      const res = await save.mutateAsync({
        document: presentRef.current,
        baseVersion: versionRef.current,
      })
      versionRef.current = res.version
      setSaveState(dirtyRef.current ? "saving" : "saved")
    } catch (err) {
      dirtyRef.current = true
      const status = (err as { response?: { status?: number } })?.response?.status
      setSaveState(status === 409 ? "conflict" : "error")
    } finally {
      savingRef.current = false
      if (dirtyRef.current) scheduleFlush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save])

  const scheduleFlush = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void flush(), AUTOSAVE_MS)
  }, [flush])

  const applyEdit = React.useCallback(
    (producer: (doc: FormDocument) => FormDocument, coalesceKey?: string) => {
      setHistory((h) => {
        if (!h) return h
        const next = producer(h.present)
        presentRef.current = next
        const now = Date.now()
        const co = coalesceRef.current
        const canCoalesce =
          coalesceKey != null && co?.key === coalesceKey && now - co.at < COALESCE_MS
        coalesceRef.current = coalesceKey != null ? { key: coalesceKey, at: now } : null
        return canCoalesce ? amend(h, next) : commit(h, next)
      })
      dirtyRef.current = true
      setDirty(true)
      setSaveState("saving")
      scheduleFlush()
    },
    [scheduleFlush]
  )

  // Flush on unmount.
  React.useEffect(() => () => void flush(), [flush])

  // ── Field operations ───────────────────────────────────────────────────────
  function addField(type: FieldType) {
    const field = newField(type)
    applyEdit((d) => ({ ...d, fields: [...d.fields, field] }))
    setSelection({ kind: "field", key: field.key })
    setPaletteOpen(false)
  }
  function updateField(key: string, next: FormField, coalesce?: boolean) {
    applyEdit(
      (d) => ({ ...d, fields: d.fields.map((f) => (f.key === key ? next : f)) }),
      coalesce ? `field:${key}` : undefined
    )
  }
  function deleteField(key: string) {
    applyEdit((d) => ({ ...d, fields: d.fields.filter((f) => f.key !== key) }))
    setSelection((s) => (s?.kind === "field" && s.key === key ? null : s))
  }
  function moveField(key: string, dir: -1 | 1) {
    applyEdit((d) => {
      const i = d.fields.findIndex((f) => f.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.fields.length) return d
      const fields = d.fields.slice()
      ;[fields[i], fields[j]] = [fields[j]!, fields[i]!]
      return { ...d, fields }
    })
  }

  function handlePublish() {
    void (async () => {
      await flush()
      try {
        await publish.mutateAsync()
        setDirty(false)
        toast.success("Form published")
        // The form's home is where you land after publishing — not the builder.
        router.push(`/forms/${params.id}`)
      } catch {
        toast.error("Couldn't publish the form")
      }
    })()
  }

  // ── Navbar (injected into the shared editor chrome — one bar, not two) ──────
  const cU = history ? canUndo(history) : false
  const cR = history ? canRedo(history) : false
  const changeCount = history ? editCount(history) : 0
  useSetNavbar(
    {
      minimal: true,
      bleed: true,
      leftActions: (
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/forms/${params.id}`} />}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <input
            value={doc?.title ?? ""}
            onChange={(e) => applyEdit((d) => ({ ...d, title: e.target.value }), "title")}
            className="min-w-0 truncate bg-transparent text-[15px] font-semibold outline-none"
            placeholder="Untitled form"
            aria-label="Form title"
          />
        </div>
      ),
      actions: (
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Undo"
                  disabled={!cU}
                  onClick={() => setHistory((h) => (h ? undo(h) : h))}
                />
              }
            >
              <Undo2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Redo"
                  disabled={!cR}
                  onClick={() => setHistory((h) => (h ? redo(h) : h))}
                />
              }
            >
              <Redo2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Redo</TooltipContent>
          </Tooltip>
          <span className="mr-1 ml-0.5 font-mono text-xs text-muted-foreground tabular-nums">
            {changeCount} {changeCount === 1 ? "change" : "changes"}
          </span>
          <SaveIndicator state={saveState} />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!doc}
                  onClick={() => setPreviewOpen(true)}
                />
              }
            >
              <Eye className="size-4" />
              Preview
            </TooltipTrigger>
            <TooltipContent side="bottom">Preview your draft edits</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={!dirty || publish.isPending}
                />
              }
            >
              {publish.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {form?.status === "PUBLISHED" ? "Update" : "Publish"}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {dirty
                ? "Publish your changes to the live form"
                : "No changes to publish"}
            </TooltipContent>
          </Tooltip>
        </div>
      ),
    },
    // NOTE: only STABLE / primitive deps here. `applyEdit` and `router` are
    // recreated every render (applyEdit ← the react-query save mutation), so
    // including them would make this effect re-run → set() → re-render → loop
    // ("Maximum update depth exceeded"). The injected node still closes over the
    // current applyEdit/router; `doc?.title` re-injects on every keystroke.
    [
      doc?.title,
      cU,
      cR,
      changeCount,
      saveState,
      dirty,
      publish.isPending,
      form?.status,
      params.id,
    ]
  )

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--l-canvas)]">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const design = resolveFormDesign(doc.design)
  const selectedField =
    selection?.kind === "field"
      ? doc.fields.find((f) => f.key === selection.key) ?? null
      : null

  return (
    <div className="flex h-full min-h-0 bg-[var(--l-canvas)] text-foreground">
        {/* Left — field list */}
        <aside className="flex w-72 flex-none flex-col border-r bg-background">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Fields
            </span>
            <button
              aria-label="Add field"
              onClick={() => setPaletteOpen((v) => !v)}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {doc.fields.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No fields yet. Add one to start.
              </p>
            )}
            {doc.fields.map((field, i) => {
              const Icon = FIELD_TYPES[field.type].icon
              const active = selection?.kind === "field" && selection.key === field.key
              return (
                <div
                  key={field.key}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2 py-2 text-sm",
                    active ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                >
                  <button
                    onClick={() => setSelection({ kind: "field", key: field.key })}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                    <Icon className="size-4 flex-none" />
                    <span className="truncate">{field.title || FIELD_TYPES[field.type].label}</span>
                  </button>
                  <div className="flex flex-none items-center opacity-0 group-hover:opacity-100">
                    <button
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => moveField(field.key, -1)}
                      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      aria-label="Move down"
                      disabled={i === doc.fields.length - 1}
                      onClick={() => moveField(field.key, 1)}
                      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                    <button
                      aria-label="Delete field"
                      onClick={() => deleteField(field.key)}
                      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}

            {paletteOpen && (
              <FieldPalette onPick={addField} onClose={() => setPaletteOpen(false)} />
            )}
            {!paletteOpen && (
              <button
                onClick={() => setPaletteOpen(true)}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
              >
                <Plus className="size-4" />
                Add field
              </button>
            )}
          </div>

          {/* Thank-you + design shortcuts */}
          <div className="border-t p-2">
            <button
              onClick={() => setSelection({ kind: "thankyou" })}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm",
                selection?.kind === "thankyou" ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}
            >
              <Check className="size-4" />
              Thank-you page
            </button>
            <button
              onClick={() => setSelection({ kind: "design" })}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm",
                selection?.kind === "design" ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}
            >
              <Palette className="size-4" />
              Design
            </button>
            <button
              onClick={() => setSelection({ kind: "settings" })}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm",
                selection?.kind === "settings" ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}
            >
              <Settings2 className="size-4" />
              Settings
            </button>
          </div>
        </aside>

        {/* Center — preview */}
        <main
          className="flex min-w-0 flex-1 items-center justify-center overflow-y-auto p-10"
          style={{ background: design.background }}
        >
          {selection?.kind === "thankyou" ? (
            <div
              className={cn(
                "flex w-full max-w-xl flex-col gap-2",
                design.align === "center" ? "items-center text-center" : "items-start"
              )}
            >
              <h2 className="text-2xl font-semibold" style={{ color: design.question }}>
                {doc.thankYou.title}
              </h2>
              {doc.thankYou.description && (
                <p style={{ color: `${design.question}b3` }}>{doc.thankYou.description}</p>
              )}
            </div>
          ) : (
            <PreviewField
              field={selectedField ?? doc.fields[0] ?? null}
              design={design}
              fallback="Add a field to preview"
            />
          )}
        </main>

        {/* Right — settings */}
        <aside className="w-80 flex-none overflow-y-auto border-l bg-background p-4">
          {selection?.kind === "design" ? (
            <DesignPanel design={design} onChange={(d) => applyEdit((doc) => ({ ...doc, design: d }))} />
          ) : selection?.kind === "settings" ? (
            <div className="flex flex-col gap-4">
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium">Accepting submissions</span>
                <Switch
                  checked={doc.settings.acceptingSubmissions}
                  onCheckedChange={(v) =>
                    applyEdit((d) => ({ ...d, settings: { ...d.settings, acceptingSubmissions: v } }))
                  }
                />
              </label>
              {!doc.settings.acceptingSubmissions && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Closed message</span>
                  <Textarea
                    rows={2}
                    value={doc.settings.closedMessage}
                    onChange={(e) =>
                      applyEdit((d) => ({ ...d, settings: { ...d.settings, closedMessage: e.target.value } }), "closed-msg")
                    }
                  />
                </label>
              )}
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium">Show progress bar</span>
                <Switch
                  checked={doc.settings.showProgressBar}
                  onCheckedChange={(v) =>
                    applyEdit((d) => ({ ...d, settings: { ...d.settings, showProgressBar: v } }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Redirect URL after submit (optional)
                </span>
                <Input
                  value={doc.settings.redirectUrl ?? ""}
                  placeholder="https://…"
                  onChange={(e) =>
                    applyEdit(
                      (d) => ({
                        ...d,
                        settings: { ...d.settings, redirectUrl: e.target.value.trim() || null },
                      }),
                      "redirect"
                    )
                  }
                />
              </label>
            </div>
          ) : selection?.kind === "thankyou" ? (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Title</span>
                <Input
                  value={doc.thankYou.title}
                  onChange={(e) =>
                    applyEdit((d) => ({ ...d, thankYou: { ...d.thankYou, title: e.target.value } }), "ty-title")
                  }
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Message</span>
                <Textarea
                  rows={3}
                  value={doc.thankYou.description}
                  onChange={(e) =>
                    applyEdit((d) => ({ ...d, thankYou: { ...d.thankYou, description: e.target.value } }), "ty-desc")
                  }
                />
              </label>
            </div>
          ) : selectedField ? (
            <FieldSettings
              field={selectedField}
              onChange={(next) => updateField(selectedField.key, next, true)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a field to edit its settings.
            </p>
          )}
        </aside>

      {/* Draft preview — reflects your unsaved edits, one question at a time. */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-5 py-3">
            <DialogTitle className="text-sm font-medium">
              Preview — {doc.title || "Untitled form"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            <PublicFormView previewDoc={doc} embedded />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PreviewField({
  field,
  design,
  fallback,
}: {
  field: FormField | null
  design: ReturnType<typeof resolveFormDesign>
  fallback: string
}) {
  if (!field) return <p className="text-sm text-muted-foreground">{fallback}</p>
  return <FormFieldView field={field} value={undefined} design={design} />
}

/** Searchable list of field types to add. */
function FieldPalette({
  onPick,
  onClose,
}: {
  onPick: (type: FieldType) => void
  onClose: () => void
}) {
  const [q, setQ] = React.useState("")
  const results = FIELD_TYPE_ORDER.filter((t) =>
    FIELD_TYPES[t].label.toLowerCase().includes(q.trim().toLowerCase())
  )
  return (
    <div className="mt-1 rounded-lg border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b px-2.5 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose()
            if (e.key === "Enter" && results[0]) onPick(results[0])
          }}
          placeholder="Search fields…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {results.map((t) => {
          const Icon = FIELD_TYPES[t].icon
          return (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span className="flex size-7 flex-none items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{FIELD_TYPES[t].label}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {FIELD_TYPES[t].description}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    saved: { text: "Saved", cls: "text-muted-foreground" },
    saving: { text: "Saving…", cls: "text-muted-foreground" },
    error: { text: "Save failed", cls: "text-red-500" },
    conflict: { text: "Edited elsewhere — reload", cls: "text-amber-500" },
  }[state]
  return <span className={cn("px-1 text-xs", map.cls)}>{map.text}</span>
}
