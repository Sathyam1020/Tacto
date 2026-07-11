import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  BlockType,
  GuideBlockInput,
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
  blocks: GuideBlock[]
}

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

/** Save the whole guide (title, summary, ordered blocks) in one write. */
export function useUpdateGuide(guideId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      title: string
      summary: string | null
      blocks: GuideBlockInput[]
    }) => {
      const { data } = await api.put(`/guides/${guideId}`, payload)
      return data
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
