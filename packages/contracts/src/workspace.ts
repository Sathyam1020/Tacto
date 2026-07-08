import { z } from "zod";

/**
 * Workspace contracts. Workspaces are better-auth organizations —
 * these schemas cover the payloads our UI sends and the shapes it reads.
 */

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give your workspace a name")
    .max(50, "Workspace names are 50 characters max"),
});

export const renameWorkspaceSchema = createWorkspaceSchema;

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type RenameWorkspaceInput = z.infer<typeof renameWorkspaceSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullish(),
  createdAt: z.coerce.date(),
});

export type Workspace = z.infer<typeof workspaceSchema>;

export const workspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
