import { z } from "zod";

import { clickRectSchema } from "./capture.js";

/**
 * Guide editing + publishing contracts.
 *
 * A guide is an ordered list of typed blocks. Only STEP blocks are numbered
 * in display; HEADING/TIP/ALERT are annotations. `content` is HTML (the API
 * sanitizes it on save).
 */

export const blockTypeSchema = z.enum(["STEP", "HEADING", "TIP", "ALERT"]);
export type BlockType = z.infer<typeof blockTypeSchema>;

/** A block as sent by the editor on save. `id` absent → newly created. */
export const guideBlockInputSchema = z.object({
  id: z.string().optional(),
  type: blockTypeSchema,
  content: z.string().max(20_000),
  /** R2 object key of the block's screenshot (STEP blocks). */
  screenshotKey: z.string().nullish(),
  elementLabel: z.string().nullish(),
  url: z.string().nullish(),
  /** Preserved through edits so the click pointer survives (not edited). */
  clickRect: clickRectSchema.nullish(),
});
export type GuideBlockInput = z.infer<typeof guideBlockInputSchema>;

export const updateGuideSchema = z.object({
  title: z.string().trim().min(1, "Give your guide a title").max(200),
  summary: z.string().max(2000).nullish(),
  blocks: z.array(guideBlockInputSchema).max(500),
});
export type UpdateGuideInput = z.infer<typeof updateGuideSchema>;

/** Move a guide to another workspace (and a folder within it) the caller is a
 *  member of. Every guide belongs to a folder, so a destination folder is
 *  required. */
export const moveGuideSchema = z.object({
  organizationId: z.string().min(1),
  folderId: z.string().min(1),
});

/** Assign a guide to a folder in the same workspace (null = uncategorized). */
export const setGuideFolderSchema = z.object({
  folderId: z.string().min(1).nullable(),
});
export type SetGuideFolderInput = z.infer<typeof setGuideFolderSchema>;
export type MoveGuideInput = z.infer<typeof moveGuideSchema>;

/** A block as returned to clients (screenshotUrl is presigned for display). */
export const guideBlockSchema = z.object({
  id: z.string(),
  type: blockTypeSchema,
  position: z.number(),
  content: z.string(),
  screenshotKey: z.string().nullable(),
  screenshotUrl: z.string().nullable(),
  elementLabel: z.string().nullable(),
  url: z.string().nullable(),
  confidence: z.number().nullable(),
});
export type GuideBlock = z.infer<typeof guideBlockSchema>;
