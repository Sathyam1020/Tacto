import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

/** Which library a folder belongs to. Guide and Form folders are independent. */
export type FolderKind = "GUIDE" | "FORM"

/** A folder as returned by the API — mirrors apps/api folder feature. */
export type Folder = {
  id: string
  name: string
  isDefault: boolean
  position: number
  /** Count of items (guides or forms, per the folder's kind) in the folder. */
  itemCount: number
  createdAt: string
  updatedAt: string
}

/**
 * Folders for a workspace + kind — the active workspace, or any other the user
 * belongs to (the move flow lists a destination workspace's folders). Keyed by
 * workspace + kind so Guide/Form folders never bleed into each other.
 */
export function useFolders(
  workspaceId: string | undefined,
  kind: FolderKind = "GUIDE"
) {
  return useQuery({
    queryKey: ["folders", workspaceId, kind],
    queryFn: async () => {
      const { data } = await api.get<{ folders: Folder[] }>("/folders", {
        params: { kind, ...(workspaceId ? { workspaceId } : {}) },
      })
      return data.folders
    },
    enabled: !!workspaceId,
  })
}

export function useCreateFolder(kind: FolderKind = "GUIDE") {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<{ folder: Folder }>("/folders", {
        name,
        kind,
      })
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
      queryClient.invalidateQueries({ queryKey: ["forms"] })
    },
  })
}
