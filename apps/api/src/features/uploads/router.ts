import { imageUploadSchema } from "@workspace/contracts/settings";
import { assetUploadSchema } from "@workspace/contracts/showcase";
import { presignPut } from "@workspace/storage";
import { Router } from "express";
import { nanoid } from "nanoid";

import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";

/**
 * Presigned uploads. The browser PUTs the file straight to R2; we only mint the
 * URL. Keys go under `img/{scope}/…` so the public image proxy serves them (and
 * only them). The read URL is the stable `/api/img/{key}` proxy — never a raw
 * presigned URL (those expire). The proxy redirects to a presigned GET and R2
 * serves the stored content-type, so it works for images AND video/PDF.
 */
export const uploadsRouter: Router = Router();

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

// Avatar / workspace-logo images.
uploadsRouter.post(
  "/api/uploads/image",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { kind, contentType } = imageUploadSchema.parse(req.body);
    const scope =
      kind === "avatar" ? `user/${req.user!.id}` : `org/${req.workspace!.id}`;
    const key = `img/${scope}/${nanoid()}.${EXT[contentType]}`;
    const uploadUrl = await presignPut(key, contentType);
    res.json({ key, uploadUrl, url: `/api/img/${key}` });
  }
);

// Showcase resource assets (video / PDF).
uploadsRouter.post(
  "/api/uploads/asset",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { contentType } = assetUploadSchema.parse(req.body);
    const key = `img/asset/${req.workspace!.id}/${nanoid()}.${EXT[contentType]}`;
    const uploadUrl = await presignPut(key, contentType);
    res.json({ key, uploadUrl, url: `/api/img/${key}` });
  }
);
