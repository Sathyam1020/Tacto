import { z } from "zod";

/**
 * Folder contracts. Folders are flat, workspace-scoped groupings of guides.
 */

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Name your folder").max(80),
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const renameFolderSchema = z.object({
  name: z.string().trim().min(1, "Name your folder").max(80),
});
export type RenameFolderInput = z.infer<typeof renameFolderSchema>;
