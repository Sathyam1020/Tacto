import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  MAX_ASSET_BYTES,
  SHOWCASE_ASSET_TYPES,
  type AddResourceInput,
  type ShowcaseCard,
  type ShowcaseDetail,
  type ShowcaseSettingsInput,
} from "@workspace/contracts/showcase"

import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

const LIST = ["showcases"]
const one = (id: string) => ["showcase", id]

/** All showcases in the active workspace (cards). */
export function useShowcases() {
  const { data: ws } = authClient.useActiveOrganization()
  return useQuery({
    queryKey: [...LIST, ws?.id],
    queryFn: async () => {
      const { data } = await api.get<{ showcases: ShowcaseCard[] }>("/showcases")
      return data.showcases
    },
    enabled: !!ws?.id,
  })
}

/** One showcase's full detail. */
export function useShowcase(id: string) {
  return useQuery({
    queryKey: one(id),
    queryFn: async () => {
      const { data } = await api.get<{ detail: ShowcaseDetail }>(`/showcases/${id}`)
      return data.detail
    },
    enabled: !!id,
  })
}

export function useCreateShowcase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (title: string) => {
      const { data } = await api.post<{ detail: ShowcaseDetail }>("/showcases", { title })
      return data.detail
    },
    onSuccess: (detail) => {
      qc.setQueryData(one(detail.id), detail)
      void qc.invalidateQueries({ queryKey: LIST })
    },
  })
}

export function useDeleteShowcase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/showcases/${id}`)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: LIST }),
  })
}

/** Shared writer — a showcase mutation returns the fresh detail; keep both the
 *  detail cache and the list (title/status/itemCount) in sync. */
function useDetailMutation<TVars>(id: string, fn: (vars: TVars) => Promise<ShowcaseDetail>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => {
      qc.setQueryData(one(id), detail)
      void qc.invalidateQueries({ queryKey: LIST })
    },
  })
}

const detailOf = (p: Promise<{ data: { detail: ShowcaseDetail } }>) => p.then((r) => r.data.detail)

export function useUpdateShowcase(id: string) {
  return useDetailMutation<ShowcaseSettingsInput>(id, (input) =>
    detailOf(api.patch(`/showcases/${id}`, input))
  )
}
export function usePublishShowcase(id: string) {
  return useDetailMutation<boolean>(id, (publish) =>
    detailOf(api.post(`/showcases/${id}/${publish ? "publish" : "unpublish"}`))
  )
}

// ── sections ──────────────────────────────────────────────────────────────
export function useCreateSection(id: string) {
  return useDetailMutation<string>(id, (title) => detailOf(api.post(`/showcases/${id}/sections`, { title })))
}
export function useUpdateSection(id: string) {
  return useDetailMutation<{ sid: string; title?: string; hidden?: boolean }>(id, ({ sid, ...body }) =>
    detailOf(api.patch(`/showcases/${id}/sections/${sid}`, body))
  )
}
export function useDeleteSection(id: string) {
  return useDetailMutation<string>(id, (sid) => detailOf(api.delete(`/showcases/${id}/sections/${sid}`)))
}
export function useReorderSections(id: string) {
  return useDetailMutation<string[]>(id, (ids) => detailOf(api.post(`/showcases/${id}/sections/reorder`, { ids })))
}

// ── items ─────────────────────────────────────────────────────────────────
export function useAddGuides(id: string) {
  return useDetailMutation<{ sid: string; guideIds: string[] }>(id, ({ sid, guideIds }) =>
    detailOf(api.post(`/showcases/${id}/sections/${sid}/guides`, { guideIds }))
  )
}
export function useAddResource(id: string) {
  return useDetailMutation<{ sid: string; input: AddResourceInput }>(id, ({ sid, input }) =>
    detailOf(api.post(`/showcases/${id}/sections/${sid}/resource`, input))
  )
}
export function useUpdateItem(id: string) {
  return useDetailMutation<{ iid: string; title?: string | null; url?: string }>(id, ({ iid, ...body }) =>
    detailOf(api.patch(`/showcases/${id}/items/${iid}`, body))
  )
}
export function useDeleteItem(id: string) {
  return useDetailMutation<string>(id, (iid) => detailOf(api.delete(`/showcases/${id}/items/${iid}`)))
}
export function useReorderItems(id: string) {
  return useDetailMutation<{ sid: string; ids: string[] }>(id, ({ sid, ids }) =>
    detailOf(api.post(`/showcases/${id}/sections/${sid}/items/reorder`, { ids }))
  )
}

// ── guide picker ────────────────────────────────────────────────────────────
export type AvailableGuide = { id: string; title: string; stepCount: number }
export function useAvailableGuides(id: string, q: string, enabled: boolean) {
  return useQuery({
    queryKey: ["showcase-guides", id, q],
    queryFn: async () => {
      const { data } = await api.get<{ guides: AvailableGuide[] }>(
        `/showcases/${id}/available-guides${q ? `?q=${encodeURIComponent(q)}` : ""}`
      )
      return data.guides
    },
    enabled,
  })
}

/** Upload a resource asset (video/pdf) → returns the stable proxy URL. */
export async function uploadAsset(file: File): Promise<string> {
  const contentType = file.type
  if (!(SHOWCASE_ASSET_TYPES as readonly string[]).includes(contentType)) {
    throw new Error("Use an MP4/WebM video or a PDF")
  }
  const max = MAX_ASSET_BYTES[contentType as (typeof SHOWCASE_ASSET_TYPES)[number]]
  if (file.size > max) throw new Error(`File is too large (max ${Math.round(max / 1024 / 1024)} MB)`)
  const { data } = await api.post<{ key: string; uploadUrl: string; url: string }>("/uploads/asset", {
    contentType,
  })
  const put = await fetch(data.uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: file })
  if (!put.ok) throw new Error("Upload failed — try again")
  return data.url
}
