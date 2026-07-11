import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

/** A folder as returned by the API — mirrors apps/api folder feature. */
export type Folder = {
  id: string
  name: string
  isDefault: boolean
  position: number
  guideCount: number
  createdAt: string
  updatedAt: string
}

/**
 * Folders for a workspace — the active one, or any other the user belongs to
 * (the move flow lists a destination workspace's folders). Workspace-keyed so
 * switching never bleeds.
 */
export function useFolders(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["folders", workspaceId],
    queryFn: async () => {
      const { data } = await api.get<{ folders: Folder[] }>("/folders", {
        params: workspaceId ? { workspaceId } : undefined,
      })
      return data.folders
    },
    enabled: !!workspaceId,
  })
}

export function useCreateFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<{ folder: Folder }>("/folders", { name })
      return data.folder
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
  })
}

export function useRenameFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { folderId: string; name: string }) => {
      const { data } = await api.patch<{ folder: Folder }>(
        `/folders/${vars.folderId}`,
        { name: vars.name }
      )
      return data.folder
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
  })
}

/** Delete a folder — its guides fall back to uncategorized (never deleted). */
export function useDeleteFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (folderId: string) => {
      await api.delete(`/folders/${folderId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] })
      queryClient.invalidateQueries({ queryKey: ["guides"] })
    },
  })
}
