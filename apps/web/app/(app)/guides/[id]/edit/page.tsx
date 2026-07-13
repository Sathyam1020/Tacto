"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  DEFAULT_CUSTOMIZATION,
  type Asset,
  type BlockType,
  type DraftDocumentV2,
  type GuideCustomization,
} from "@workspace/contracts/guide"
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Pencil,
  Redo2,
  Trash2,
  Undo2,
  WifiOff,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { AddBlockMenu } from "@/components/add-block-menu"
import { BlockView, withStepNumbers } from "@/components/block-view"
import { ViewModeToggle, type ViewMode } from "@/components/guide-view"
import { InteractiveEditor } from "@/components/interactive-editor"
import {
  GuideCustomizationProvider,
  layoutMaxWidthClass,
} from "@/components/guide-customization-context"
import { GuideToolbar } from "@/components/guide-toolbar"
import { ImageEditor } from "@/components/image-editor"
import type { ImportedBlock } from "@/components/import-steps-dialog"
import { useSetNavbar } from "@/components/navbar-context"
import { RichTextEditor } from "@/components/rich-text-editor"
import { authClient } from "@/lib/auth-client"
import {
  amend,
  canRedo,
  canUndo,
  commit,
  editCount,
  initHistory,
  redo,
  undo,
  type History,
} from "@/lib/editor-history"
import { guideFontFamily } from "@/lib/guide-fonts"
import { downloadGuidePdf } from "@/lib/pdf"
import {
  clearDraftCache,
  reconcileDraft,
  readDraftCache,
  writeDraftCache,
} from "@/lib/draft-cache"
import {
  signMediaKeys,
  useDiscardDraft,
  useGuide,
  useGuideDraft,
  usePublishDraft,
  useSaveDraft,
  uploadStepMedia,
  type DraftBlockClient,
  type DraftDocumentClient,
  type GuideDraftResponse,
  type WalkthroughItemClient,
} from "@/lib/guides"

/** The editor's in-memory block (draft block + a display URL). */
type EditorBlock = DraftBlockClient
/** The Interactive tree the editor carries through (edited in RFC phase 2). */
type EditorInteractive = { items: WalkthroughItemClient[] }
/** The whole working document the editor edits and autosaves. Holds BOTH trees
 *  (List `blocks` + `interactive`) and the shared `assets` registry; List edits
 *  never touch `interactive`, so the two stay independent. */
type EditorDoc = {
  title: string
  summary: string | null
  blocks: EditorBlock[]
  interactive: EditorInteractive
  assets: Asset[]
  customization: GuideCustomization
}

const NEW_CONTENT: Record<BlockType, string> = {
  STEP: "<p>New step</p>",
  HEADING: "<p>New heading</p>",
  TIP: "<p>Add a tip</p>",
  ALERT: "<p>Add an alert</p>",
  OUTCOME: "<p>The result appears</p>",
}

const EMPTY_DOC: EditorDoc = {
  title: "",
  summary: null,
  blocks: [],
  interactive: { items: [] },
  assets: [],
  customization: DEFAULT_CUSTOMIZATION,
}

/** Coalesce typing into one undo step; debounce autosave. */
const COALESCE_MS = 600
const AUTOSAVE_MS = 1000

type DraftStatus = "saving" | "saved" | "conflict" | "error" | "offline"

/** The editor document with display URLs — the shape stored in the cache. */
function toClientDoc(doc: EditorDoc): DraftDocumentClient {
  return {
    v: 2,
    title: doc.title,
    summary: doc.summary,
    blocks: doc.blocks,
    interactive: doc.interactive,
    assets: doc.assets,
    customization: doc.customization,
  }
}

function fromClientDoc(doc: DraftDocumentClient): EditorDoc {
  const blocks = doc.blocks.map((b) => ({ ...b }))
  // Backward-compat: a draft cached in localStorage before the two-tree model
  // has no `interactive`/`assets`. Seed the Interactive tree 1:1 from blocks
  // (the client-side mirror of the server's migrate-on-read) so old caches
  // don't crash the editor.
  const items: WalkthroughItemClient[] = doc.interactive?.items
    ? doc.interactive.items.map((it) => ({ ...it }))
    : blocks.map((b) => ({
        kind: "step" as const,
        key: b.key,
        content: b.content,
        screenshotKey: b.screenshotKey,
        assetId: b.screenshotKey ? `a_${b.key}` : null,
        screenshotUrl: b.screenshotUrl,
        clickRect: b.clickRect,
        confidence: b.confidence,
        calloutBg: null,
        calloutText: null,
      }))
  return {
    title: doc.title,
    summary: doc.summary,
    customization: doc.customization,
    blocks,
    interactive: { items },
    assets: doc.assets ? doc.assets.map((a) => ({ ...a })) : [],
  }
}

/** Whether a save failure looks like an offline/network error. */
function isOffline(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ERR_NETWORK"
  )
}

/** The server's current version from a 409 conflict body. */
function conflictVersion(err: unknown): number | null {
  const v = (
    err as {
      response?: { data?: { error?: { currentVersion?: number } } }
    }
  )?.response?.data?.error?.currentVersion
  return typeof v === "number" ? v : null
}

/** Strip display-only fields to the durable document that gets autosaved. */
function toDraftDocument(doc: EditorDoc): DraftDocumentV2 {
  return {
    v: 2,
    title: doc.title,
    summary: doc.summary,
    blocks: doc.blocks.map((b) => ({
      key: b.key,
      type: b.type,
      content: b.content,
      screenshotKey: b.screenshotKey,
      assetId: b.assetId,
      elementLabel: b.elementLabel,
      url: b.url,
      clickRect: b.clickRect,
      confidence: b.confidence,
    })),
    // Carry the Interactive tree through untouched (durable fields only —
    // drop the presigned screenshotUrl the client added).
    interactive: {
      items: doc.interactive.items.map((it) =>
        it.kind === "step"
          ? {
              kind: "step",
              key: it.key,
              content: it.content,
              screenshotKey: it.screenshotKey,
              assetId: it.assetId,
              clickRect: it.clickRect,
              confidence: it.confidence,
              calloutBg: it.calloutBg,
              calloutText: it.calloutText,
            }
          : it
      ),
    },
    assets: doc.assets,
    customization: doc.customization,
  }
}

function fromDraft(res: GuideDraftResponse): EditorDoc {
  return fromClientDoc(res.document)
}

function isConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    (err as { response?: { status?: number } }).response?.status === 409
  )
}

export default function GuideEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const viewHref = `/guides/${params.id}`

  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: guide } = useGuide(activeWorkspace?.id, params.id)
  const draftQuery = useGuideDraft(activeWorkspace?.id, params.id)

  const saveDraft = useSaveDraft(params.id)
  const discardDraft = useDiscardDraft(params.id)
  const publishMutation = usePublishDraft(params.id)

  const [history, setHistory] = React.useState<History<EditorDoc>>(() =>
    initHistory(EMPTY_DOC)
  )
  const doc = history.present
  const cust = doc.customization

  const [seeded, setSeeded] = React.useState(false)
  // Which mode the canvas edits. Interactive is a read-only preview until the
  // dedicated interactive editor lands (RFC phase 2).
  const [editorMode, setEditorMode] = React.useState<ViewMode>("list")
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  const [uploadingKey, setUploadingKey] = React.useState<string | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [status, setStatus] = React.useState<DraftStatus>("saved")
  const [savedAt, setSavedAt] = React.useState<number | null>(null)
  const [now, setNow] = React.useState(0)
  const [publishing, setPublishing] = React.useState(false)
  const [leaveOpen, setLeaveOpen] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const [conflictOpen, setConflictOpen] = React.useState(false)
  // Global image editor target (shared by List + Interactive).
  const [imageEdit, setImageEdit] = React.useState<{
    src: string
    source: { assetId: string | null; itemKey: string; scope: "block" | "step" }
  } | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const mediaTargetKey = React.useRef<string | null>(null)
  const initialized = React.useRef(false)
  const versionRef = React.useRef(0)
  const presentRef = React.useRef(doc)
  const savingRef = React.useRef(false)
  const draftDirtyRef = React.useRef(false) // present changed since last save
  const pausedRef = React.useRef(false) // stop autosave after a conflict
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const cacheTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const conflictVersionRef = React.useRef<number | null>(null)
  const paintedRef = React.useRef(false) // painted from the local cache yet?
  const lastText = React.useRef<{ field: string; at: number }>({
    field: "",
    at: 0,
  })

  // ── Local cache (instant resume + offline buffer) ─────────────────────
  const persistCache = React.useCallback((unsynced: boolean) => {
    writeDraftCache(params.id, {
      document: toClientDoc(presentRef.current),
      version: versionRef.current,
      unsynced,
      savedAt: Date.now(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scheduleCache = React.useCallback(() => {
    if (cacheTimer.current) clearTimeout(cacheTimer.current)
    cacheTimer.current = setTimeout(() => persistCache(true), 300)
  }, [persistCache])
  // The mutation fn via a ref so the autosave callbacks stay stable (react-query
  // returns a fresh object each render). Mirrored in an effect, read only from
  // the debounced flush (well after commit).
  const saveDraftRef = React.useRef(saveDraft.mutateAsync)
  React.useEffect(() => {
    presentRef.current = doc
    saveDraftRef.current = saveDraft.mutateAsync
  })

  // ── Autosave (debounced, optimistic-concurrency) ──────────────────────
  // Drains all pending edits: if new edits arrive mid-save, the loop saves the
  // latest present again. Stable identity (no unstable deps).
  const flush = React.useCallback(async () => {
    if (savingRef.current || pausedRef.current) return
    savingRef.current = true
    try {
      while (draftDirtyRef.current && !pausedRef.current) {
        draftDirtyRef.current = false
        setStatus("saving")
        try {
          const res = await saveDraftRef.current({
            document: toDraftDocument(presentRef.current),
            baseVersion: versionRef.current,
          })
          versionRef.current = res.version
          persistCache(false) // synced
          setSavedAt(Date.now())
          setStatus("saved")
        } catch (err) {
          draftDirtyRef.current = true // keep the change; retry later
          persistCache(true) // unsynced — offline buffer / retry
          if (isConflict(err)) {
            pausedRef.current = true
            conflictVersionRef.current = conflictVersion(err)
            setStatus("conflict")
            setConflictOpen(true)
          } else if (isOffline(err)) {
            setStatus("offline") // will retry on the `online` event
          } else {
            setStatus("error")
          }
          break
        }
      }
    } finally {
      savingRef.current = false
    }
  }, [persistCache])

  const scheduleFlush = React.useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flush(), AUTOSAVE_MS)
  }, [flush])

  React.useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (cacheTimer.current) clearTimeout(cacheTimer.current)
    }
  }, [])

  // Reconnect: resume autosaving any buffered edits.
  React.useEffect(() => {
    function onOnline() {
      if (draftDirtyRef.current && !pausedRef.current) {
        setStatus("saving")
        void flush()
      }
    }
    function onOffline() {
      if (draftDirtyRef.current) setStatus("offline")
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [flush])

  // Save-on-exit. On tab *switch* the page is alive, so do a proper async flush
  // (keeps the version in sync). On real *unload*, sendBeacon is the only option
  // (the POST /draft route accepts it — PATCH can't beacon). On bfcache restore,
  // resync the version so a beaconed save doesn't look like a conflict.
  React.useEffect(() => {
    function beacon() {
      if (!draftDirtyRef.current || pausedRef.current) return
      try {
        const body = JSON.stringify({
          baseVersion: versionRef.current,
          document: toDraftDocument(presentRef.current),
        })
        navigator.sendBeacon(
          `/api/guides/${params.id}/draft`,
          new Blob([body], { type: "application/json" })
        )
      } catch {
        /* best-effort */
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") void flush()
    }
    function onPageShow(e: PageTransitionEvent) {
      if (!e.persisted) return
      void latest.current.refetchDraft().then((res) => {
        if (res.data) versionRef.current = res.data.version
      })
    }
    window.addEventListener("pagehide", beacon)
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      window.removeEventListener("pagehide", beacon)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [flush])

  // ── Seeding (initial load + after discard) ────────────────────────────
  const seed = React.useCallback((res: GuideDraftResponse) => {
    setHistory(initHistory(fromDraft(res)))
    versionRef.current = res.version
    draftDirtyRef.current = false
    pausedRef.current = false
    conflictVersionRef.current = null
    paintedRef.current = true
    setDirty(res.isDirty)
    setStatus("saved")
    setSavedAt(Date.now())
    setSeeded(true)
    setConflictOpen(false)
    // Mirror the authoritative server draft into the cache (synced).
    writeDraftCache(params.id, {
      document: res.document,
      version: res.version,
      unsynced: false,
      savedAt: Date.now(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-sign a restored draft's images (in-memory URLs die on a hard reload).
  const rehydrateImages = React.useCallback(
    async (document: DraftDocumentClient) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      const keys = Array.from(
        new Set(
          [
            ...document.blocks.map((b) => b.screenshotKey),
            ...document.interactive.items.map((it) =>
              it.kind === "step" ? it.screenshotKey : null
            ),
          ].filter((k): k is string => !!k)
        )
      )
      if (keys.length === 0) return
      try {
        const urls = await signMediaKeys(keys)
        setHistory((h) => ({
          ...h,
          present: {
            ...h.present,
            blocks: h.present.blocks.map((b) =>
              b.screenshotKey && urls[b.screenshotKey]
                ? { ...b, screenshotUrl: urls[b.screenshotKey]! }
                : b
            ),
            interactive: {
              items: h.present.interactive.items.map((it) =>
                it.kind === "step" && it.screenshotKey && urls[it.screenshotKey]
                  ? { ...it, screenshotUrl: urls[it.screenshotKey]! }
                  : it
              ),
            },
          },
        }))
      } catch {
        /* offline / transient — images stay as-is */
      }
    },
    []
  )

  // Instant resume: paint from the local cache immediately (no skeleton).
  React.useEffect(() => {
    const cached = readDraftCache(params.id)
    if (cached && !paintedRef.current) {
      paintedRef.current = true
      setHistory(initHistory(fromClientDoc(cached.document)))
      versionRef.current = cached.version
      setDirty(cached.unsynced)
      setSeeded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reconcile with the authoritative server draft once it settles.
  React.useEffect(() => {
    if (!draftQuery.data || draftQuery.isFetching || initialized.current) return
    initialized.current = true
    const server = draftQuery.data
    const cached = readDraftCache(params.id)
    const decision = reconcileDraft(cached, server.version)
    if (decision === "server" || !cached) {
      seed(server)
      return
    }
    if (!paintedRef.current) {
      paintedRef.current = true
      setHistory(initHistory(fromClientDoc(cached.document)))
      versionRef.current = cached.version
      setSeeded(true)
    }
    void rehydrateImages(cached.document)
    if (decision === "cache") {
      setDirty(true)
      draftDirtyRef.current = true
      scheduleFlush() // push local offline edits up
    } else {
      conflictVersionRef.current = server.version
      pausedRef.current = true
      setDirty(true)
      setStatus("conflict")
      setConflictOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuery.data, draftQuery.isFetching])

  // Relative-time ticker for the draft status.
  React.useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  // ── Edit application (history + dirty + autosave) ──────────────────────
  const applyEdit = React.useCallback(
    (
      producer: (doc: EditorDoc) => EditorDoc,
      coalesceField?: "title" | "summary"
    ) => {
      let coalesce = false
      if (coalesceField) {
        const t = Date.now()
        coalesce =
          lastText.current.field === coalesceField &&
          t - lastText.current.at < COALESCE_MS
        lastText.current = { field: coalesceField, at: t }
      }
      setHistory((h) => (coalesce ? amend : commit)(h, producer(h.present)))
      setDirty(true)
      draftDirtyRef.current = true
      scheduleFlush()
      scheduleCache()
    },
    [scheduleFlush, scheduleCache]
  )

  const markDirty = React.useCallback(() => setDirty(true), [])

  // Export the current draft (what the editor shows), not the published guide.
  const exportPdf = React.useCallback(() => {
    const d = latest.current.present
    void downloadGuidePdf({
      title: d.title,
      summary: d.summary,
      blocks: d.blocks,
      customization: d.customization,
    })
  }, [])

  const doUndo = React.useCallback(() => {
    setHistory((h) => (canUndo(h) ? undo(h) : h))
    setDirty(true)
    draftDirtyRef.current = true
    scheduleFlush()
    scheduleCache()
  }, [scheduleFlush, scheduleCache])

  const doRedo = React.useCallback(() => {
    setHistory((h) => (canRedo(h) ? redo(h) : h))
    setDirty(true)
    draftDirtyRef.current = true
    scheduleFlush()
    scheduleCache()
  }, [scheduleFlush, scheduleCache])

  // Keyboard undo/redo — but never hijack text-field / rich-editor undo.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== "z") return
      const el = document.activeElement as HTMLElement | null
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      if (e.shiftKey) doRedo()
      else doUndo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [doUndo, doRedo])

  // ── Stable actions for the navbar (read live state from a ref) ─────────
  const latest = React.useRef({
    present: doc,
    dirty,
    publish: publishMutation.mutateAsync,
    discard: discardDraft.mutateAsync,
    refetchDraft: draftQuery.refetch,
  })
  React.useEffect(() => {
    latest.current = {
      present: doc,
      dirty,
      publish: publishMutation.mutateAsync,
      discard: discardDraft.mutateAsync,
      refetchDraft: draftQuery.refetch,
    }
  })

  const handleBack = React.useCallback(() => {
    if (latest.current.dirty) setLeaveOpen(true)
    else router.push(viewHref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePublish = React.useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setPublishing(true)
    try {
      // Ensure the server draft reflects the latest edits before publishing:
      // wait out any in-flight autosave, then flush anything still pending.
      for (let i = 0; savingRef.current && i < 60; i++) {
        await new Promise((r) => setTimeout(r, 50))
      }
      await flush()
      // Apply that draft to the published content (server-side, transactional)
      // and delete it.
      await latest.current.publish()
      clearDraftCache(params.id)
      setDirty(false)
      router.push(viewHref)
    } finally {
      setPublishing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function confirmDiscard() {
    await latest.current.discard()
    const res = await latest.current.refetchDraft()
    if (res.data) seed(res.data)
    setDirty(false)
    setDiscardOpen(false)
  }

  async function leaveKeepingDraft() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await flush()
    router.push(viewHref)
  }

  async function leaveDiscardingDraft() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await latest.current.discard().catch(() => {})
    clearDraftCache(params.id)
    router.push(viewHref)
  }

  // Conflict resolution — take the server's version, or overwrite with mine.
  async function resolveReload() {
    const res = await latest.current.refetchDraft()
    if (res.data) seed(res.data)
    else {
      pausedRef.current = false
      setStatus("saved")
      setConflictOpen(false)
    }
  }

  async function resolveOverwrite() {
    const v = conflictVersionRef.current
    if (v == null) return void resolveReload()
    try {
      const res = await saveDraftRef.current({
        document: toDraftDocument(presentRef.current),
        baseVersion: v,
      })
      versionRef.current = res.version
      pausedRef.current = false
      draftDirtyRef.current = false
      persistCache(false)
      setSavedAt(Date.now())
      setStatus("saved")
      setConflictOpen(false)
    } catch (err) {
      if (isConflict(err)) conflictVersionRef.current = conflictVersion(err)
      else setStatus("error")
    }
  }

  // ── Block operations (all route through applyEdit) ────────────────────
  function insertBlock(index: number, type: BlockType) {
    const block: EditorBlock = {
      key: crypto.randomUUID(),
      type,
      content: NEW_CONTENT[type],
      screenshotKey: null,
      assetId: null,
      screenshotUrl: null,
      elementLabel: null,
      url: null,
      clickRect: null,
      confidence: null,
    }
    applyEdit((d) => ({
      ...d,
      blocks: [...d.blocks.slice(0, index), block, ...d.blocks.slice(index)],
    }))
    setEditingKey(block.key)
  }

  function updateContent(key: string, content: string) {
    applyEdit((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.key === key ? { ...b, content } : b)),
    }))
    setEditingKey(null)
  }

  function deleteBlock(key: string) {
    applyEdit((d) => ({ ...d, blocks: d.blocks.filter((b) => b.key !== key) }))
  }

  // ── Interactive (Walkthrough) tree operations ─────────────────────────
  // Independent of the List blocks — these only touch `doc.interactive`.
  function editInteractiveContent(key: string, content: string) {
    applyEdit((d) => ({
      ...d,
      interactive: {
        items: d.interactive.items.map((it) =>
          it.key === key && it.kind === "step" ? { ...it, content } : it
        ),
      },
    }))
  }

  function reorderInteractive(orderedKeys: string[]) {
    applyEdit((d) => {
      const byKey = new Map(d.interactive.items.map((it) => [it.key, it]))
      const items = orderedKeys
        .map((k) => byKey.get(k))
        .filter((it): it is (typeof d.interactive.items)[number] => !!it)
      return { ...d, interactive: { items } }
    })
  }

  function deleteInteractiveItem(key: string) {
    applyEdit((d) => ({
      ...d,
      interactive: {
        items: d.interactive.items.filter((it) => it.key !== key),
      },
    }))
  }

  /** Insert a walkthrough item (Intro/Chapter slide) after `afterKey` (null =
   *  prepend for intros). */
  function insertInteractiveItem(
    item: WalkthroughItemClient,
    afterKey: string | null
  ) {
    applyEdit((d) => {
      const items = [...d.interactive.items]
      const idx = afterKey ? items.findIndex((i) => i.key === afterKey) : -1
      items.splice(idx >= 0 ? idx + 1 : 0, 0, item)
      return { ...d, interactive: { items } }
    })
  }

  /** Merge a partial patch into a walkthrough item (slide fields/buttons or a
   *  step's media). */
  function updateInteractiveItem(
    key: string,
    patch: Partial<WalkthroughItemClient>
  ) {
    applyEdit((d) => ({
      ...d,
      interactive: {
        items: d.interactive.items.map((it) =>
          it.key === key
            ? ({ ...it, ...patch } as WalkthroughItemClient)
            : it
        ),
      },
    }))
  }

  /** Upload a replacement screenshot for an Interactive step. Returns the R2
   *  key + a local preview URL (independent of the List blocks). */
  async function uploadInteractiveMedia(
    file: File
  ): Promise<{ key: string; url: string } | null> {
    try {
      const key = await uploadStepMedia(params.id, file)
      return { key, url: URL.createObjectURL(file) }
    } catch {
      return null
    }
  }

  /** Global image edit: swap an edited screenshot's key everywhere its shared
   *  Asset is referenced (List blocks + Interactive steps + the registry). When
   *  the source has no assetId (ad-hoc media), only that one item changes. */
  function replaceImage(
    source: { assetId: string | null; itemKey: string; scope: "block" | "step" },
    newKey: string,
    newUrl: string
  ) {
    applyEdit((d) => {
      if (source.assetId) {
        const id = source.assetId
        return {
          ...d,
          assets: d.assets.map((a) => (a.id === id ? { ...a, key: newKey } : a)),
          blocks: d.blocks.map((b) =>
            b.assetId === id
              ? { ...b, screenshotKey: newKey, screenshotUrl: newUrl }
              : b
          ),
          interactive: {
            items: d.interactive.items.map((it) =>
              it.kind === "step" && it.assetId === id
                ? { ...it, screenshotKey: newKey, screenshotUrl: newUrl }
                : it
            ),
          },
        }
      }
      if (source.scope === "block") {
        return {
          ...d,
          blocks: d.blocks.map((b) =>
            b.key === source.itemKey
              ? { ...b, screenshotKey: newKey, screenshotUrl: newUrl }
              : b
          ),
        }
      }
      return {
        ...d,
        interactive: {
          items: d.interactive.items.map((it) =>
            it.key === source.itemKey && it.kind === "step"
              ? { ...it, screenshotKey: newKey, screenshotUrl: newUrl }
              : it
          ),
        },
      }
    })
  }

  function importBlocks(imported: ImportedBlock[]) {
    applyEdit((d) => ({
      ...d,
      blocks: [
        ...d.blocks,
        ...imported.map((b) => ({
          key: crypto.randomUUID(),
          type: b.type,
          content: b.content,
          screenshotKey: b.screenshotKey,
          assetId: null,
          screenshotUrl: b.screenshotUrl,
          elementLabel: b.elementLabel,
          url: b.url,
          clickRect: b.clickRect,
          confidence: null,
        })),
      ],
    }))
  }

  function reorderBlocks(orderedKeys: string[]) {
    applyEdit((d) => {
      const byKey = new Map(d.blocks.map((b) => [b.key, b]))
      const next = orderedKeys
        .map((k) => byKey.get(k))
        .filter((b): b is EditorBlock => !!b)
      return next.length === d.blocks.length ? { ...d, blocks: next } : d
    })
  }

  function applyCustomization(next: GuideCustomization) {
    applyEdit((d) => ({ ...d, customization: next }))
  }

  function pickMedia(key: string) {
    mediaTargetKey.current = key
    fileInputRef.current?.click()
  }

  async function onMediaSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const key = mediaTargetKey.current
    e.target.value = ""
    if (!file || !key) return
    setUploadingKey(key)
    try {
      const objectKey = await uploadStepMedia(params.id, file)
      const previewUrl = URL.createObjectURL(file)
      applyEdit((d) => ({
        ...d,
        blocks: d.blocks.map((b) =>
          b.key === key
            ? { ...b, screenshotKey: objectKey, screenshotUrl: previewUrl }
            : b
        ),
      }))
    } finally {
      setUploadingKey(null)
    }
  }

  // ── Navbar ────────────────────────────────────────────────────────────
  const cU = canUndo(history)
  const cR = canRedo(history)
  const count = editCount(history)
  useSetNavbar(
    {
      minimal: true,
      leftActions: (
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {seeded && (
            <DraftStatusLabel status={status} savedAt={savedAt} now={now} />
          )}
        </div>
      ),
      actions: (
        <div className="flex items-center gap-1.5">
          <NavIcon label="Undo" onClick={doUndo} disabled={!cU}>
            <Undo2 className="size-4" />
          </NavIcon>
          <NavIcon label="Redo" onClick={doRedo} disabled={!cR}>
            <Redo2 className="size-4" />
          </NavIcon>
          <span className="mr-1 ml-0.5 font-mono text-xs text-muted-foreground tabular-nums">
            {count} {count === 1 ? "change" : "changes"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDiscardOpen(true)}
            disabled={!dirty || publishing}
          >
            Discard draft
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={publishing}>
            {publishing ? "Updating…" : "Update guide"}
          </Button>
        </div>
      ),
    },
    [
      handleBack,
      doUndo,
      doRedo,
      handlePublish,
      seeded,
      status,
      savedAt,
      now,
      cU,
      cR,
      count,
      dirty,
      publishing,
    ]
  )

  if (!seeded) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="mt-8 h-24 w-full" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    )
  }

  const numbered = withStepNumbers(doc.blocks)

  return (
    <GuideCustomizationProvider value={cust}>
      {guide && (
        <GuideToolbar
          guide={guide}
          customization={cust}
          onCustomizationChange={applyCustomization}
          sortRows={doc.blocks.map((b) => ({
            key: b.key,
            type: b.type,
            content: b.content,
            screenshotUrl: b.screenshotUrl,
          }))}
          onReorder={reorderBlocks}
          onImport={importBlocks}
          onDirty={markDirty}
          onExport={exportPdf}
        />
      )}
      <div
        className={cn(
          "mx-auto pb-24",
          layoutMaxWidthClass(cust.general.pageLayout)
        )}
        dir={cust.brand.rtl ? "rtl" : undefined}
        style={
          {
            ["--primary" as string]: cust.brand.color,
            fontFamily: guideFontFamily(cust.brand.font),
          } as React.CSSProperties
        }
      >
        {/* Editable title — auto-grows so long headings wrap and show fully */}
        <textarea
          value={doc.title}
          onChange={(e) =>
            applyEdit((d) => ({ ...d, title: e.target.value }), "title")
          }
          rows={1}
          placeholder="Untitled guide"
          className="[field-sizing:content] w-full resize-none bg-transparent font-serif text-4xl leading-tight font-medium tracking-tight outline-none placeholder:text-muted-foreground/40"
        />

        {/* Editable subheading / description */}
        <textarea
          value={doc.summary ?? ""}
          onChange={(e) =>
            applyEdit(
              (d) => ({ ...d, summary: e.target.value || null }),
              "summary"
            )
          }
          rows={1}
          placeholder="Add a description (optional)"
          className="mt-3 [field-sizing:content] w-full resize-none bg-transparent text-lg leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/40"
        />

        {/* Mode selector — the title/description above are global; the content
            below is mode-specific. Centered between the two. */}
        <div className="mt-8 flex justify-center">
          <ViewModeToggle
            mode={editorMode}
            onChange={setEditorMode}
            size="lg"
          />
        </div>

        <div className="mt-8">
          {editorMode === "list" ? (
            <>
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
                    onEditImage={() => {
                      if (block.screenshotUrl)
                        setImageEdit({
                          src: block.screenshotUrl,
                          source: {
                            assetId: block.assetId,
                            itemKey: block.key,
                            scope: "block",
                          },
                        })
                    }}
                  />
                  <AddBlockMenu
                    onAdd={(type) => insertBlock(index + 1, type)}
                  />
                </React.Fragment>
              ))}
            </>
          ) : (
            <InteractiveEditor
              items={doc.interactive.items}
              customization={cust}
              onEditContent={editInteractiveContent}
              onReorder={reorderInteractive}
              onDelete={deleteInteractiveItem}
              onInsertItem={insertInteractiveItem}
              onUpdateItem={updateInteractiveItem}
              onUploadMedia={uploadInteractiveMedia}
              onEditImage={(source, src) => setImageEdit({ src, source })}
            />
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={onMediaSelected}
        />

        {/* Global image editor (List + Interactive) */}
        <ImageEditor
          open={!!imageEdit}
          src={imageEdit?.src ?? null}
          onClose={() => setImageEdit(null)}
          onSave={async (blob) => {
            const target = imageEdit
            if (!target) return
            const file = new File([blob], "edited.png", { type: "image/png" })
            const res = await uploadInteractiveMedia(file)
            if (res) replaceImage(target.source, res.key, res.url)
          }}
        />

        {/* Leave editor */}
        <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-medium tracking-tight">
                Leave editor?
              </DialogTitle>
              <DialogDescription>
                Your changes are saved as a private draft. They won&apos;t be
                visible until you update the guide.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
                Continue editing
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setLeaveOpen(false)
                  void leaveDiscardingDraft()
                }}
              >
                Discard draft
              </Button>
              <Button onClick={() => void leaveKeepingDraft()}>
                Leave &amp; keep draft
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Discard draft (from the navbar) */}
        <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-medium tracking-tight">
                Discard draft?
              </DialogTitle>
              <DialogDescription>
                This deletes your draft and reverts the editor to the published
                guide. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDiscardOpen(false)}>
                Keep editing
              </Button>
              <Button
                variant="destructive"
                onClick={() => void confirmDiscard()}
                disabled={discardDraft.isPending}
              >
                Discard draft
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Conflict — the draft changed on another device. Must be resolved. */}
        <Dialog open={conflictOpen} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-medium tracking-tight">
                Edited on another device
              </DialogTitle>
              <DialogDescription>
                This guide&apos;s draft changed somewhere else. Keep the changes
                you made here, or load the other version instead.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => void resolveReload()}>
                Load their version
              </Button>
              <Button onClick={() => void resolveOverwrite()}>
                Keep my changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </GuideCustomizationProvider>
  )
}

/** Relative "Draft saved …" indicator in the navbar. */
function DraftStatusLabel({
  status,
  savedAt,
  now,
}: {
  status: DraftStatus
  savedAt: number | null
  now: number
}) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Saving draft…
      </span>
    )
  }
  if (status === "offline") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <WifiOff className="size-3" />
        Offline — saved on this device
      </span>
    )
  }
  if (status === "conflict") {
    return (
      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
        Edited elsewhere
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="text-xs text-destructive">Couldn&apos;t save draft</span>
    )
  }
  if (savedAt == null) return null
  return (
    <span className="text-xs text-muted-foreground">
      Draft saved {formatAgo(savedAt, now)}
    </span>
  )
}

function formatAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.round(m / 60)}h ago`
}

function NavIcon({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
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
  onEditImage,
}: {
  block: EditorBlock & { stepNumber?: number }
  stepNumber?: number
  editing: boolean
  uploading: boolean
  onStartEdit: () => void
  onSaveContent: (html: string) => void
  onCancelEdit: () => void
  onDelete: () => void
  onAddMedia: () => void
  onEditImage: () => void
}) {
  return (
    <div className="group relative rounded-xl border border-transparent px-4 py-4 transition-colors hover:border-border">
      {/* Controls */}
      {!editing && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {block.type === "STEP" && block.screenshotUrl && (
            <button
              aria-label="Edit image"
              title="Edit image"
              onClick={onEditImage}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <Pencil className="size-4" />
            </button>
          )}
          {block.type === "STEP" && (
            <button
              aria-label="Add media"
              onClick={onAddMedia}
              disabled={uploading}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
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
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
