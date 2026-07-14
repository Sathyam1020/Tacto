import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { BASE_LANGUAGE, type VideoExportView } from "@workspace/contracts/voice"

import { api } from "@/lib/api"

function exportKey(guideId: string, language: string, silent: boolean) {
  return ["video-export", guideId, language, silent]
}

function exportParams(language: string, silent: boolean) {
  return { language, ...(silent ? { silent: "true" } : {}) }
}

/** Languages whose video export carries voiceover (audio ready). The base
 *  language and the "no voiceover" option are added by the caller. */
export function useVoiceoverLanguages(guideId: string) {
  return useQuery({
    queryKey: ["voiceover-languages", guideId],
    queryFn: async () => {
      const { data } = await api.get<{ languages: string[] }>(
        `/guides/${guideId}/export/video/languages`
      )
      return data.languages
    },
    enabled: !!guideId,
  })
}

/** Poll the video-export status for a guide/language while it's rendering.
 *  `silent` targets the no-voiceover variant. */
export function useVideoExport(
  guideId: string,
  language = BASE_LANGUAGE,
  silent = false
) {
  return useQuery({
    queryKey: exportKey(guideId, language, silent),
    queryFn: async () => {
      const { data } = await api.get<{ export: VideoExportView }>(
        `/guides/${guideId}/export/video`,
        { params: exportParams(language, silent) }
      )
      return data.export
    },
    enabled: !!guideId,
    refetchInterval: (query) =>
      query.state.data?.status === "generating" ? 2500 : false,
  })
}

/** Kick off an async video export (composed on the worker). */
export function useGenerateVideo(
  guideId: string,
  language = BASE_LANGUAGE,
  silent = false
) {
  const queryClient = useQueryClient()
  const key = exportKey(guideId, language, silent)
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ export: VideoExportView }>(
        `/guides/${guideId}/export/video`,
        null,
        { params: exportParams(language, silent) }
      )
      return data.export
    },
    onSuccess: (view) => queryClient.setQueryData(key, view),
  })
}
