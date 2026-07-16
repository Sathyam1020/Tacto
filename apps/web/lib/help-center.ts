import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
  AnalyticsRange,
  GuideHelpPlacement,
  HelpCenterAnalytics,
  HelpCenterDetail,
  HelpCenterSettingsInput,
} from "@workspace/contracts/help-center"

import { authClient } from "@/lib/auth-client"
import { api } from "@/lib/api"

/** The workspace's Help Center (get-or-create). One per workspace. */
const KEY = ["help-center"]

export function useHelpCenter() {
  const { data: ws } = authClient.useActiveOrganization()
  return useQuery({
    queryKey: [...KEY, ws?.id],
    queryFn: async () => {
      const { data } = await api.get<{ helpCenter: HelpCenterDetail }>("/help-center")
      return data.helpCenter
    },
    enabled: !!ws?.id,
  })
}

/** Shared cache writer — every owner mutation returns the fresh detail. */
function useDetailMutation<TVars>(
  fn: (vars: TVars) => Promise<{ detail: HelpCenterDetail }>
) {
  const qc = useQueryClient()
  const { data: ws } = authClient.useActiveOrganization()
  return useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      qc.setQueryData([...KEY, ws?.id], res.detail)
    },
  })
}

export function useUpdateHelpCenter() {
  return useDetailMutation(async (input: HelpCenterSettingsInput) => {
    const { data } = await api.patch<{ helpCenter: HelpCenterDetail }>(
      "/help-center",
      input
    )
    return { detail: data.helpCenter }
  })
}

export function usePublishHelpCenter() {
  const qc = useQueryClient()
  const { data: ws } = authClient.useActiveOrganization()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{
        helpCenter: { status: "DRAFT" | "PUBLISHED"; publishedAt: string; slug: string }
      }>("/help-center/publish")
      return data.helpCenter
    },
    onSuccess: (hc) => {
      qc.setQueryData<HelpCenterDetail>([...KEY, ws?.id], (prev) =>
        prev ? { ...prev, status: hc.status, publishedAt: hc.publishedAt } : prev
      )
    },
  })
}

// ── Collections ──────────────────────────────────────────────────────────────
export function useCreateCollection() {
  return useDetailMutation(async (input: { name: string; icon?: string }) => {
    const { data } = await api.post<{ detail: HelpCenterDetail }>(
      "/help-center/collections",
      input
    )
    return { detail: data.detail }
  })
}
export function useUpdateCollection() {
  return useDetailMutation(
    async (vars: {
      id: string
      name?: string
      description?: string | null
      icon?: string | null
      hidden?: boolean
    }) => {
      const { id, ...body } = vars
      const { data } = await api.patch<{ detail: HelpCenterDetail }>(
        `/help-center/collections/${id}`,
        body
      )
      return { detail: data.detail }
    }
  )
}
export function useDeleteCollection() {
  return useDetailMutation(async (id: string) => {
    const { data } = await api.delete<{ detail: HelpCenterDetail }>(
      `/help-center/collections/${id}`
    )
    return { detail: data.detail }
  })
}
export function useReorderCollections() {
  return useDetailMutation(async (ids: string[]) => {
    const { data } = await api.post<{ detail: HelpCenterDetail }>(
      "/help-center/collections/reorder",
      { ids }
    )
    return { detail: data.detail }
  })
}
export function useDuplicateCollection() {
  return useDetailMutation(async (id: string) => {
    const { data } = await api.post<{ detail: HelpCenterDetail }>(
      `/help-center/collections/${id}/duplicate`
    )
    return { detail: data.detail }
  })
}

// ── Articles ─────────────────────────────────────────────────────────────────
export function useAddArticles() {
  return useDetailMutation(async (vars: { collectionId: string; guideIds: string[] }) => {
    const { data } = await api.post<{ detail: HelpCenterDetail }>(
      `/help-center/collections/${vars.collectionId}/articles`,
      { guideIds: vars.guideIds }
    )
    return { detail: data.detail }
  })
}
export function useRemoveArticle() {
  return useDetailMutation(async (id: string) => {
    const { data } = await api.delete<{ detail: HelpCenterDetail }>(
      `/help-center/articles/${id}`
    )
    return { detail: data.detail }
  })
}
export function useReorderArticles() {
  return useDetailMutation(async (ids: string[]) => {
    const { data } = await api.post<{ detail: HelpCenterDetail }>(
      "/help-center/articles/reorder",
      { ids }
    )
    return { detail: data.detail }
  })
}
export function useFeatureArticle() {
  return useDetailMutation(async (vars: { id: string; featured: boolean }) => {
    const { data } = await api.post<{ detail: HelpCenterDetail }>(
      `/help-center/articles/${vars.id}/feature`,
      { featured: vars.featured }
    )
    return { detail: data.detail }
  })
}

// ── Picker + guide placement ────────────────────────────────────────────────
export type AvailableGuide = { id: string; title: string; stepCount: number }

export function useAvailableGuides(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ["help-center-available-guides", q],
    queryFn: async () => {
      const { data } = await api.get<{ guides: AvailableGuide[] }>(
        "/help-center/available-guides",
        { params: q ? { q } : undefined }
      )
      return data.guides
    },
    enabled,
  })
}

/** Help-center-level engagement analytics for a range (visits, searches, …). */
export function useHelpAnalytics(range: AnalyticsRange) {
  const { data: ws } = authClient.useActiveOrganization()
  return useQuery({
    queryKey: [...KEY, "analytics", ws?.id, range],
    queryFn: async () => {
      const { data } = await api.get<{ analytics: HelpCenterAnalytics }>(
        `/help-center/analytics?range=${range}`
      )
      return data.analytics
    },
    enabled: !!ws?.id,
  })
}

/** Where a guide is published in the help center (editor "Published In"). */
export function useGuidePlacement(guideId: string) {
  return useQuery({
    queryKey: ["guide-help-placement", guideId],
    queryFn: async () => {
      const { data } = await api.get<{ placement: GuideHelpPlacement | null }>(
        `/guides/${guideId}/help-placements`
      )
      return data.placement
    },
    enabled: !!guideId,
  })
}
