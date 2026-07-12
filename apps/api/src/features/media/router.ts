import { presignGet, presignPut } from "@workspace/storage";
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
    .regex(
      /^(image\/(png|jpe?g|webp|gif)|audio\/(mpeg|mp3|wav|ogg|webm|mp4))$/,
      "Unsupported file type"
    ),
});

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "audio/mp4": "m4a",
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

const signSchema = z.object({ keys: z.array(z.string()).max(500) });

/**
 * Presign a batch of R2 keys for display — used when the editor restores a
 * draft from its local cache (whose in-memory image URLs died on reload).
 * Only keys owned by the caller's workspace are signed.
 */
mediaRouter.post(
  "/api/media/sign",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { keys } = signSchema.parse(req.body);
    const prefix = `media/${req.workspace!.id}/`;
    const entries = await Promise.all(
      keys
        .filter((key) => key.startsWith(prefix))
        .map(async (key) => [key, await presignGet(key)] as const)
    );
    res.json({ urls: Object.fromEntries(entries) });
  }
);
