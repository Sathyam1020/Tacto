import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type BlockType,
  type DraftBlock,
  type DraftDocumentV3,
  type GuideCustomization,
  type InteractivePresentation,
  type RetranslateTarget,
} from "@workspace/contracts/guide"
import axios from "axios"
import { toast } from "sonner"

import { api } from "@/lib/api"

/** Guide API types — mirrors apps/api guide feature responses. */
export type GuideListItem = {
  id: string
  title: string
  summary: string | null
  status: "DRAFT" | "PUBLISHED"
  shareId: string | null
  stepCount: number
  coverUrl: string | null
  pinnedAt: string | null
  viewCount: number
  folderId: string | null
  aiGenerated: boolean
  author: { name: string; image: string | null }
  createdAt: string
  updatedAt: string
}

export type ActiveCapture = {
  id: string
  title: string | null
  source: "EXTENSION" | "VIDEO_UPLOAD" | "IMPORT"
  status: "UPLOADING" | "PROCESSING" | "FAILED"
  errorMessage: string | null
  /** FAILED captures that still have their source data can be re-run. */
  retryable: boolean
  createdAt: string
}

export type ClickRect = { x: number; y: number; w: number; h: number }

export type GuideBlock = {
  id: string
  /** Stable Step identity — lets the Interactive renderer match slide anchors +
   *  per-step presentation. */
  key: string
  type: BlockType
  position: number
  content: string
  screenshotKey: string | null
  screenshotUrl: string | null
  elementLabel: string | null
  url: string | null
  clickRect: ClickRect | null
  confidence: number | null
}

export type GuideDetail = {
  id: string
  title: string
  summary: string | null
  status: "DRAFT" | "PUBLISHED"
  shareId: string | null
  publishedAt: string | null
  viewCount: number
  captureSource: "EXTENSION" | "VIDEO_UPLOAD" | "IMPORT" | null
  createdAt: string
  customization: GuideCustomization | null
  /** True when a private draft has edits not yet published. */
  hasUnpublishedChanges: boolean
  blocks: GuideBlock[]
  /** The published Interactive *presentation* (slides + per-step overrides).
   *  Step content/screenshots come from `blocks` (the canonical Steps). */
  interactive: InteractivePresentation
}

/** Merge stored (possibly null/partial) customization with defaults.
 *  Re-exported from contracts so the server and web resolve identically. */
export { resolveCustomization } from "@workspace/contracts/guide"

/** Workspace-keyed so switching workspaces refetches, never bleeds. */
export function useGuides(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["guides", workspaceId],
    queryFn: async () => {
      const { data } = await api.get<{ guides: GuideListItem[] }>("/guides")
      return data.guides
    },
    enabled: !!workspaceId,
  })
}

/**
 * In-flight captures (uploading/processing/failed). Polls while anything
 * is active; when a capture completes it leaves this list — we invalidate
 * the guides list so the new guide appears.
 */
export function useActiveCaptures(workspaceId: string | undefined) {
  const queryClient = useQueryClient()
  // Remember each capture's last-seen status so we can notify on the
  // moment it transitions to FAILED (not for failures already present on
  // first load — those show as persistent cards, no toast spam).
  const lastStatus = React.useRef<Map<string, ActiveCapture["status"]>>(
    new Map()
  )
  const isActive = (s: ActiveCapture["status"]) =>
    s === "PROCESSING" || s === "UPLOADING"
  return useQuery({
    queryKey: ["captures", workspaceId],
    queryFn: async () => {
      const { data } = await api.get<{ captures: ActiveCapture[] }>(
        "/captures"
      )
      for (const capture of data.captures) {
        const before = lastStatus.current.get(capture.id)
        if (before && before !== "FAILED" && capture.status === "FAILED") {
          toast.error(`Couldn't process “${capture.title ?? "your capture"}”`, {
            description:
              capture.errorMessage ??
              "Something went wrong. Retry or dismiss it below.",
          })
        }
      }
      // Was anything in flight on the *previous* poll? Compare before we
      // overwrite lastStatus, so we can detect the exact completion moment.
      const wasProcessing = [...lastStatus.current.values()].some(isActive)
      lastStatus.current = new Map(
        data.captures.map((capture) => [capture.id, capture.status])
      )
      const nowProcessing = data.captures.some((c) => isActive(c.status))

      // A capture just finished (in flight → gone). Pull the freshly-created
      // guide and AWAIT it, so it's in cache before this query resolves and the
      // processing card is removed — no empty gap between card and guide.
      if (wasProcessing && !nowProcessing) {
        await queryClient.refetchQueries({
          queryKey: ["guides", workspaceId],
        })
      }
      return data.captures
    },
    enabled: !!workspaceId,
    // Discover captures started elsewhere the moment we refocus this tab…
    refetchOnWindowFocus: true,
    // …and poll fast while work is in flight, gently otherwise (a fallback for
    // when recording happens in a separate window and no refocus fires).
    refetchInterval: (query) =>
      query.state.data?.some((c) => isActive(c.status)) ? 3000 : 10_000,
  })
}

export function useGuide(workspaceId: string | undefined, guideId: string) {
  return useQuery({
    queryKey: ["guide", workspaceId, guideId],
    queryFn: async () => {
      const { data } = await api.get<{ guide: GuideDetail }>(
        `/guides/${guideId}`
      )
      return data.guide
    },
    enabled: !!workspaceId && !!guideId,
  })
}

// ── Editor draft ───────────────────────────────────────────────────────────

/** A draft block as returned to the editor (durable fields + a display URL). */
export type DraftBlockClient = DraftBlock & { screenshotUrl: string | null }
/** The editor draft (v3): canonical Steps (`blocks`) + an Interactive
 *  presentation. The presentation carries no images, so it passes through. */
export type DraftDocumentClient = Omit<DraftDocumentV3, "blocks"> & {
  blocks: DraftBlockClient[]
  interactive: InteractivePresentation
}
export type GuideDraftResponse = {
  document: DraftDocumentClient
  version: number
  /** Whether the draft differs from the published guide (unpublished changes). */
  isDirty: boolean
}

/**
 * Get-or-create the guide's draft, seeded from the published content. Fetched
 * fresh on each editor mount (so another session/device resumes correctly),
 * then the editor owns the state locally — no refetch mid-edit.
 */
export function useGuideDraft(
  workspaceId: string | undefined,
  guideId: string
) {
  return useQuery({
    queryKey: ["draft", guideId],
    queryFn: async () => {
      const { data } = await api.get<GuideDraftResponse>(
        `/guides/${guideId}/draft`
      )
      return data
    },
    enabled: !!workspaceId && !!guideId,
    // Always read the true server version on open; never resume from a stale
    // cache (which would desync the autosave version → spurious 409).
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
}

export type SaveDraftVars = { document: DraftDocumentV3; baseVersion: number }

/** Autosave the draft with optimistic concurrency. Throws on 409 conflict. */
export function useSaveDraft(guideId: string) {
  return useMutation({
    mutationFn: async ({ document, baseVersion }: SaveDraftVars) => {
      const { data } = await api.patch<{ version: number; updatedAt: string }>(
        `/guides/${guideId}/draft`,
        { document, baseVersion }
      )
      return data
    },
  })
}

/** Discard the draft (revert to the published guide). */
export function useDiscardDraft(guideId: string) {
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/guides/${guideId}/draft`)
    },
  })
}

/**
 * Publish the draft: apply it to the guide's published content (server-side,
 * transactionally) and delete the draft. Visibility (Share) is unaffected.
 */
export function usePublishDraft(guideId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post(`/guides/${guideId}/publish-draft`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guide"] })
      void queryClient.invalidateQueries({ queryKey: ["guides"] })
    },
  })
}

export function usePublishGuide(guideId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (publish: boolean) => {
      const { data } = await api.post(
        `/guides/${guideId}/${publish ? "publish" : "unpublish"}`
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guide"] })
      void queryClient.invalidateQueries({ queryKey: ["guides"] })
    },
  })
}

/** Retry a failed capture — re-enqueues processing. */
export function useRetryCapture(workspaceId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (captureId: string) => {
      const { data } = await api.post(`/captures/${captureId}/retry`)
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["captures", workspaceId] }),
  })
}

/** Dismiss (soft-delete) a capture — clears it from the home list. */
export function useDismissCapture(workspaceId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (captureId: string) => {
      await api.delete(`/captures/${captureId}`)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["captures", workspaceId] }),
  })
}

/** Pin / unpin a guide (toggle). Invalidates the list so order updates. */
export function usePinGuide() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (guideId: string) => {
      const { data } = await api.post<{ guide: { pinnedAt: string | null } }>(
        `/guides/${guideId}/pin`
      )
      return data.guide
    },
    // Optimistic: flip pinnedAt in the cache immediately so the guide reorders
    // (the list re-sorts pinned-first) without waiting for the round-trip.
    onMutate: async (guideId) => {
      await queryClient.cancelQueries({ queryKey: ["guides"] })
      const snapshots = queryClient.getQueriesData<GuideListItem[]>({
        queryKey: ["guides"],
      })
      const nowIso = new Date().toISOString()
      queryClient.setQueriesData<GuideListItem[]>(
        { queryKey: ["guides"] },
        (old) =>
          old?.map((g) =>
            g.id === guideId
              ? { ...g, pinnedAt: g.pinnedAt ? null : nowIso }
              : g
          )
      )
      return { snapshots }
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) =>
        queryClient.setQueryData(key, data)
      )
      toast.error("Couldn't update pin")
    },
    onSuccess: (guide) =>
      toast.success(guide.pinnedAt ? "Pinned to top" : "Unpinned"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["guides"] }),
  })
}

/** Duplicate a guide into a new DRAFT copy. Returns the new guide id. */
export function useCloneGuide() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (guideId: string) => {
      const { data } = await api.post<{ guide: { id: string } }>(
        `/guides/${guideId}/clone`
      )
      return data.guide
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["guides"] }),
  })
}

/** Move a guide to another workspace the caller belongs to. */
export function useMoveGuide() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      guideId: string
      organizationId: string
      folderId: string
    }) => {
      const { data } = await api.post(`/guides/${vars.guideId}/move`, {
        organizationId: vars.organizationId,
        folderId: vars.folderId,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guides"] })
      queryClient.invalidateQueries({ queryKey: ["folders"] })
    },
  })
}

/** Move a guide into a folder (or out of one when folderId is null). */
export function useSetGuideFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      guideId: string
      folderId: string | null
    }) => {
      const { data } = await api.patch(`/guides/${vars.guideId}/folder`, {
        folderId: vars.folderId,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guides"] })
      queryClient.invalidateQueries({ queryKey: ["folders"] })
    },
  })
}

/** Soft-delete a guide (removed from the workspace list). */
export function useDeleteGuide() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (guideId: string) => {
      await api.delete(`/guides/${guideId}`)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["guides"] }),
  })
}

/** Which parts of a translation have drifted from the current guide. */
export type TranslationStaleness = {
  stale: boolean
  titleStale: boolean
  summaryStale: boolean
  staleStepKeys: string[]
  newStepKeys: string[]
  removedStepKeys: string[]
  staleSlideKeys: string[]
}

/** A guide's stored translation (full content for the editor preview). */
export type GuideTranslationFull = {
  language: string
  title: string
  summary: string | null
  /** Translated block content keyed by the block's stable key. */
  steps: Record<string, string>
  /** False until the editor Saves the guide (hidden from the public reader). */
  published: boolean
  /** Async generation status — the editor polls this until ready. */
  status: "generating" | "ready" | "failed"
  /** Failure detail when status = failed. */
  error: string | null
  /** Per-translation drift vs. the current guide (which steps need a redo). */
  staleness: TranslationStaleness
}

/** A fresh (unknown) translation has no drift until compared server-side. */
export const EMPTY_STALENESS: TranslationStaleness = {
  stale: false,
  titleStale: false,
  summaryStale: false,
  staleStepKeys: [],
  newStepKeys: [],
  removedStepKeys: [],
  staleSlideKeys: [],
}

/** Translations that exist for a guide (editor list, with content). Polls
 *  while any language is still generating on the worker. */
export function useGuideTranslations(guideId: string) {
  return useQuery({
    queryKey: ["translations", guideId],
    queryFn: async () => {
      const { data } = await api.get<{
        translations: GuideTranslationFull[]
      }>(`/guides/${guideId}/translations`)
      return data.translations
    },
    enabled: !!guideId,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((t) => t.status === "generating")
        ? 1500
        : false,
  })
}

/** Kick off async translation for a language (whole guide). Returns the list
 *  with the language marked generating; the query polls until ready. */
export function useAddTranslation(guideId: string) {
  const queryClient = useQueryClient()
  const key = ["translations", guideId]
  return useMutation({
    mutationFn: async (language: string) => {
      const { data } = await api.post<{
        translations: GuideTranslationFull[]
      }>(`/guides/${guideId}/translations`, { language })
      return data.translations
    },
    // Show the language immediately as generating.
    onMutate: async (language) => {
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<GuideTranslationFull[]>(key)
      queryClient.setQueryData<GuideTranslationFull[]>(key, (old) => {
        const list = old ?? []
        const existing = list.find((t) => t.language === language)
        const generating: GuideTranslationFull = {
          language,
          title: existing?.title ?? "",
          summary: existing?.summary ?? null,
          steps: existing?.steps ?? {},
          published: false,
          status: "generating",
          error: null,
          staleness: existing?.staleness ?? EMPTY_STALENESS,
        }
        return existing
          ? list.map((t) => (t.language === language ? generating : t))
          : [...list, generating]
      })
      return { prev }
    },
    onSuccess: (translations) => queryClient.setQueryData(key, translations),
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev)
    },
  })
}

/** Remove a translation. */
export function useDeleteTranslation(guideId: string) {
  const queryClient = useQueryClient()
  const key = ["translations", guideId]
  return useMutation({
    mutationFn: async (language: string) => {
      await api.delete(`/guides/${guideId}/translations/${language}`)
    },
    onMutate: async (language) => {
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<GuideTranslationFull[]>(key)
      queryClient.setQueryData<GuideTranslationFull[]>(key, (old) =>
        (old ?? []).filter((t) => t.language !== language)
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Re-translate ONE part of an existing translation — the title, the summary, or
 *  a single step — from the current (draft-aware) guide text. The granular
 *  update behind the editor's per-row "re-translate" affordance. */
export function useRetranslate(guideId: string) {
  const queryClient = useQueryClient()
  const key = ["translations", guideId]
  return useMutation({
    mutationFn: async (vars: {
      language: string
      target: RetranslateTarget
    }) => {
      const { data } = await api.post<{
        translations: GuideTranslationFull[]
      }>(`/guides/${guideId}/translations/${vars.language}/retranslate`, {
        target: vars.target,
      })
      return data.translations
    },
    onSuccess: (translations) => queryClient.setQueryData(key, translations),
  })
}

/**
 * Upload an image to R2 for a step's media: get a presigned URL, PUT the
 * file, return the object key the block should reference.
 */
export async function uploadStepMedia(
  guideId: string,
  file: File
): Promise<string> {
  const { data } = await api.post<{ key: string; uploadUrl: string }>(
    "/media/upload-url",
    { guideId, contentType: file.type }
  )
  await axios.put(data.uploadUrl, file, {
    headers: { "Content-Type": file.type },
  })
  return data.key
}

/** Presign R2 keys for display — re-hydrates a cached draft's images whose
 *  in-memory URLs died on a reload. */
export async function signMediaKeys(
  keys: string[]
): Promise<Record<string, string>> {
  if (keys.length === 0) return {}
  const { data } = await api.post<{ urls: Record<string, string> }>(
    "/media/sign",
    { keys }
  )
  return data.urls
}
