import { presignPut } from "@workspace/storage";
import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";

import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";

/**
 * Media uploads for the editor (step screenshots). Same presigned-PUT
 * pattern as video capture — the browser uploads straight to R2, the block
 * then references the returned key.
 */
export const mediaRouter: Router = Router();

const uploadUrlSchema = z.object({
  guideId: z.string(),
  contentType: z
    .string()
    .regex(/^image\/(png|jpe?g|webp|gif)$/, "Unsupported image type"),
});

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

mediaRouter.post(
  "/api/media/upload-url",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { guideId, contentType } = uploadUrlSchema.parse(req.body);
    const key = `media/${req.workspace!.id}/${guideId}/${nanoid(16)}.${EXT[contentType]}`;
    const uploadUrl = await presignPut(key, contentType);
    res.json({ key, uploadUrl });
  }
);
