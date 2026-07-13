import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  BASE_LANGUAGE,
  type NarrationAudioSummary,
  type NarrationItemDTO,
  type NarrationStaleness,
} from "@workspace/contracts/voice"

import { api } from "@/lib/api"

/** The narration for one language — the ordered, staleness-annotated review
 *  list the editor works with. Mirrors the API's NarrationView. */
export type NarrationView = {
  language: string
  status: "idle" | "generating" | "ready" | "failed"
  error: string | null
  generated: boolean
  items: NarrationItemDTO[]
  staleness: NarrationStaleness
  audio: NarrationAudioSummary
}

function narrationKey(guideId: string, language: string) {
  return ["narration", guideId, language]
}

/** Load a guide's narration for a language (base language by default). Polls
 *  while narration generation OR audio rendering is running on the worker. */
export function useNarration(guideId: string, language = BASE_LANGUAGE) {
  return useQuery({
    queryKey: narrationKey(guideId, language),
    queryFn: async () => {
      const { data } = await api.get<{ narration: NarrationView }>(
        `/guides/${guideId}/narration`,
        { params: { language } }
      )
      return data.narration
    },
    enabled: !!guideId,
    refetchInterval: (query) => {
      const d = query.state.data
      return d?.status === "generating" || d?.audio.status === "generating"
        ? 1500
        : false
    },
  })
}

/** Render voiceover audio for the whole guide (async fan-out on the worker). */
export function useGenerateAudio(guideId: string, language = BASE_LANGUAGE) {
  const queryClient = useQueryClient()
  const key = narrationKey(guideId, language)
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ narration: NarrationView }>(
        `/guides/${guideId}/narration/audio`,
        null,
        { params: { language } }
      )
      return data.narration
    },
    onSuccess: (narration) => queryClient.setQueryData(key, narration),
  })
}

/** Generate/refresh narration for the whole guide. */
export function useGenerateNarration(guideId: string, language = BASE_LANGUAGE) {
  const queryClient = useQueryClient()
  const key = narrationKey(guideId, language)
  return useMutation({
    mutationFn: async (opts: { force?: boolean } = {}) => {
      const { data } = await api.post<{ narration: NarrationView }>(
        `/guides/${guideId}/narration/generate`,
        { force: opts.force },
        { params: { language } }
      )
      return data.narration
    },
    onSuccess: (narration) => queryClient.setQueryData(key, narration),
  })
}

/** Regenerate one step/slide's narration. */
export function useRegenerateNarrationSegment(
  guideId: string,
  language = BASE_LANGUAGE
) {
  const queryClient = useQueryClient()
  const key = narrationKey(guideId, language)
  return useMutation({
    mutationFn: async (anchorKey: string) => {
      const { data } = await api.post<{ narration: NarrationView }>(
        `/guides/${guideId}/narration/segments/${anchorKey}/regenerate`,
        null,
        { params: { language } }
      )
      return data.narration
    },
    onSuccess: (narration) => queryClient.setQueryData(key, narration),
  })
}

/** Overwrite one segment's narration with a human edit. */
export function useEditNarrationSegment(
  guideId: string,
  language = BASE_LANGUAGE
) {
  const queryClient = useQueryClient()
  const key = narrationKey(guideId, language)
  return useMutation({
    mutationFn: async (vars: { anchorKey: string; text: string }) => {
      const { data } = await api.patch<{ narration: NarrationView }>(
        `/guides/${guideId}/narration/segments/${vars.anchorKey}`,
        { text: vars.text },
        { params: { language } }
      )
      return data.narration
    },
    onSuccess: (narration) => queryClient.setQueryData(key, narration),
  })
}
