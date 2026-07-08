import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

/** Guide API types — mirrors apps/api guide feature responses. */
export type GuideListItem = {
  id: string
  title: string
  summary: string | null
  status: "DRAFT" | "PUBLISHED"
  stepCount: number
  createdAt: string
  updatedAt: string
}

export type GuideStep = {
  id: string
  position: number
  instruction: string
  elementLabel: string | null
  url: string | null
  screenshotUrl: string | null
  confidence: number | null
}

export type GuideDetail = {
  id: string
  title: string
  summary: string | null
  status: "DRAFT" | "PUBLISHED"
  createdAt: string
  steps: GuideStep[]
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
