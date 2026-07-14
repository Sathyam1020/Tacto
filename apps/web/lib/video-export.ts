import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { BASE_LANGUAGE, type VideoExportView } from "@workspace/contracts/voice"

import { api } from "@/lib/api"

function exportKey(guideId: string, language: string) {
  return ["video-export", guideId, language]
}

/** Poll the video-export status for a guide/language while it's rendering. */
export function useVideoExport(guideId: string, language = BASE_LANGUAGE) {
  return useQuery({
    queryKey: exportKey(guideId, language),
    queryFn: async () => {
      const { data } = await api.get<{ export: VideoExportView }>(
        `/guides/${guideId}/export/video`,
        { params: { language } }
      )
      return data.export
    },
    enabled: !!guideId,
    refetchInterval: (query) =>
      query.state.data?.status === "generating" ? 2500 : false,
  })
}

/** Kick off an async video export (composed on the worker). */
export function useGenerateVideo(guideId: string, language = BASE_LANGUAGE) {
  const queryClient = useQueryClient()
  const key = exportKey(guideId, language)
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ export: VideoExportView }>(
        `/guides/${guideId}/export/video`,
        null,
        { params: { language } }
      )
      return data.export
    },
    onSuccess: (view) => queryClient.setQueryData(key, view),
  })
}
