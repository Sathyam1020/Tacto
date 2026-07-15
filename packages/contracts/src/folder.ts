import { z } from "zod";

/**
 * Folder contracts. Folders are flat, workspace-scoped groupings of guides or
 * forms — the two libraries keep independent folder namespaces (`kind`).
 */

/** Which library a folder belongs to. */
export const folderKindSchema = z.enum(["GUIDE", "FORM"]);
export type FolderKind = z.infer<typeof folderKindSchema>;

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Name your folder").max(80),
  kind: folderKindSchema.default("GUIDE"),
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const renameFolderSchema = z.object({
  name: z.string().trim().min(1, "Name your folder").max(80),
});
export type RenameFolderInput = z.infer<typeof renameFolderSchema>;
