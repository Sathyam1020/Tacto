import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  BlockType,
  GuideBlockInput,
} from "@workspace/contracts/guide"
import axios from "axios"

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
  createdAt: string
  updatedAt: string
}

export type ActiveCapture = {
  id: string
  title: string | null
  source: "EXTENSION" | "VIDEO_UPLOAD" | "IMPORT"
  status: "UPLOADING" | "PROCESSING" | "FAILED"
  errorMessage: string | null
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
  return useQuery({
    queryKey: ["captures", workspaceId],
    queryFn: async () => {
      const { data } = await api.get<{ captures: ActiveCapture[] }>(
        "/captures"
      )
      const processing = data.captures.some(
        (capture) =>
          capture.status === "PROCESSING" || capture.status === "UPLOADING"
      )
      if (!processing) {
        // Something may have just finished — refresh guides.
        void queryClient.invalidateQueries({
          queryKey: ["guides", workspaceId],
        })
      }
      return data.captures
    },
    enabled: !!workspaceId,
    refetchInterval: (query) =>
      query.state.data?.some(
        (capture) =>
          capture.status === "PROCESSING" || capture.status === "UPLOADING"
      )
        ? 3000
        : false,
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["guides"] }),
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
    mutationFn: async (vars: { guideId: string; organizationId: string }) => {
      const { data } = await api.post(`/guides/${vars.guideId}/move`, {
        organizationId: vars.organizationId,
      })
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["guides"] }),
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
