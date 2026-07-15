import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import type { FormDocument } from "@workspace/contracts/form"

import { api } from "@/lib/api"

/** A form in the library grid (mirrors GuideListItem for the shared helpers). */
export type FormListItem = {
  id: string
  title: string
  description: string | null
  status: "DRAFT" | "PUBLISHED"
  shareId: string | null
  pinnedAt: string | null
  folderId: string | null
  viewCount: number
  startCount: number
  submitCount: number
  author: { name: string; image: string | null }
  createdAt: string
  updatedAt: string
}

export type FormDetail = {
  id: string
  title: string
  description: string | null
  status: "DRAFT" | "PUBLISHED"
  shareId: string | null
  publishedAt: string | null
  pinnedAt: string | null
  folderId: string | null
  documentVersion: number
  viewCount: number
  startCount: number
  submitCount: number
  hasUnpublishedChanges: boolean
  published: FormDocument | null
  createdAt: string
  updatedAt: string
}

export type FormDraftResponse = {
  document: FormDocument
  version: number
  isDirty: boolean
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useForms(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["forms", workspaceId],
    queryFn: async () => {
      const { data } = await api.get<{ forms: FormListItem[] }>("/forms")
      return data.forms
    },
    enabled: !!workspaceId,
  })
}

export function useForm(workspaceId: string | undefined, formId: string) {
  return useQuery({
    queryKey: ["form", workspaceId, formId],
    queryFn: async () => {
      const { data } = await api.get<{ form: FormDetail }>(`/forms/${formId}`)
      return data.form
    },
    enabled: !!workspaceId && !!formId,
  })
}

export function useFormDraft(workspaceId: string | undefined, formId: string) {
  return useQuery({
    queryKey: ["form-draft", formId],
    queryFn: async () => {
      const { data } = await api.get<FormDraftResponse>(`/forms/${formId}/draft`)
      return data
    },
    enabled: !!workspaceId && !!formId,
    staleTime: 0,
    gcTime: 0,
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      title: string
      description?: string | null
      folderId?: string | null
    }) => {
      const { data } = await api.post<{ form: { id: string } }>("/forms", input)
      return data.form
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  })
}

export function useSaveFormDraft(formId: string) {
  return useMutation({
    mutationFn: async (vars: { document: FormDocument; baseVersion: number }) => {
      const { data } = await api.patch<{ version: number; updatedAt: string }>(
        `/forms/${formId}/draft`,
        vars
      )
      return data
    },
  })
}

export function usePublishForm(formId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ form: unknown }>(`/forms/${formId}/publish`)
      return data.form
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["form"] })
      void queryClient.invalidateQueries({ queryKey: ["forms"] })
    },
  })
}

export function usePinForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formId: string) => {
      await api.post(`/forms/${formId}/pin`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  })
}

export function useCloneForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formId: string) => {
      const { data } = await api.post<{ form: { id: string } }>(
        `/forms/${formId}/clone`
      )
      return data.form
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  })
}

export function useSetFormFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { formId: string; folderId: string | null }) => {
      await api.patch(`/forms/${vars.formId}/folder`, { folderId: vars.folderId })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forms"] })
      void queryClient.invalidateQueries({ queryKey: ["folders"] })
    },
  })
}

export function useDeleteForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formId: string) => {
      await api.delete(`/forms/${formId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  })
}

// ── Results ──────────────────────────────────────────────────────────────────

export type FormAnalytics = {
  views: number
  starts: number
  submissions: number
  completionRate: number
  avgCompletionMs: number | null
  trend: { date: string; count: number }[]
}

export type FieldSummary = {
  key: string
  title: string
  type: string
  responses: number
  options?: { label: string; count: number }[]
  average?: number
  min?: number
  max?: number
  samples?: string[]
}

export type SubmissionItem = {
  id: string
  answers: Record<string, unknown>
  formVersion: number
  createdAt: string
}

export function useFormAnalytics(formId: string, range: "7d" | "30d" | "90d") {
  return useQuery({
    queryKey: ["form-analytics", formId, range],
    queryFn: async () => {
      const { data } = await api.get<{ analytics: FormAnalytics }>(
        `/forms/${formId}/analytics`,
        { params: { range } }
      )
      return data.analytics
    },
    enabled: !!formId,
  })
}

export function useFormSummary(formId: string) {
  return useQuery({
    queryKey: ["form-summary", formId],
    queryFn: async () => {
      const { data } = await api.get<{ summary: FieldSummary[]; total: number }>(
        `/forms/${formId}/summary`
      )
      return data
    },
    enabled: !!formId,
  })
}

export function useFormSubmissions(formId: string) {
  return useQuery({
    queryKey: ["form-submissions", formId],
    queryFn: async () => {
      const { data } = await api.get<{
        submissions: SubmissionItem[]
        nextCursor: string | null
      }>(`/forms/${formId}/submissions`)
      return data
    },
    enabled: !!formId,
  })
}
