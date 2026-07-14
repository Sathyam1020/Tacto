import { BASE_LANGUAGE, VOICE_CATALOG } from "@workspace/contracts/voice";
import { prisma } from "@workspace/db";
import {
  deleteNarration,
  editNarrationSegment,
  generateNarrationForGuide,
  getNarration,
  getVideoExport,
  getVoiceoverLanguages,
  getVoicePreview,
  markNarrationGenerating,
  markVideoExportGenerating,
  NarrationAnchorNotFound,
  prepareAudioBuild,
} from "@workspace/generation";
import { Router } from "express";
import { z } from "zod";

import { exportQueue, voiceQueue } from "../../lib/queue.js";
import { AppError } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";

/**
 * Voice (Narration) — the editor review flow. Whole-guide narration generation
 * runs ASYNC on the worker (survives closing the modal); single-step
 * regeneration and edits run synchronously (fast). Phase 2/3: base language.
 */
export const voiceRouter: Router = Router();

const idParamSchema = z.object({ id: z.string() });
const languageQuerySchema = z.object({ language: z.string().optional() });
const generateBodySchema = z.object({ force: z.boolean().optional() });
const editBodySchema = z.object({ text: z.string() });

async function assertGuide(guideId: string, workspaceId: string): Promise<void> {
  const guide = await prisma.guide.findFirst({
    where: { id: guideId, organizationId: workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");
}

// Audition a catalog voice (short cached sample). Any signed-in user; the
// voiceId must be in the curated catalog (no arbitrary synthesis).
voiceRouter.get(
  "/api/voices/:voiceId/preview",
  requireAuth,
  async (req, res) => {
    const voiceId = z.string().parse(req.params.voiceId);
    if (!VOICE_CATALOG.some((v) => v.id === voiceId)) {
      throw new AppError(404, "NOT_FOUND", "Unknown voice");
    }
    const url = await getVoicePreview(voiceId);
    res.json({ url });
  }
);

// ── Video export ──────────────────────────────────────────────────────────
// Languages whose video export would carry voiceover (audio ready). The web
// menu offers video only for these (+ the base language).
voiceRouter.get(
  "/api/guides/:id/export/video/languages",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await assertGuide(id, req.workspace!.id);
    res.json({ languages: await getVoiceoverLanguages(id) });
  }
);

// Read the export status (presigned MP4 URL when ready).
voiceRouter.get(
  "/api/guides/:id/export/video",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { language } = languageQuerySchema.parse(req.query);
    await assertGuide(id, req.workspace!.id);
    res.json({ export: await getVideoExport(id, language ?? BASE_LANGUAGE) });
  }
);

// Kick off an async video export (ffmpeg composition on the worker).
voiceRouter.post(
  "/api/guides/:id/export/video",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { language } = languageQuerySchema.parse(req.query);
    await assertGuide(id, req.workspace!.id);
    const lang = language ?? BASE_LANGUAGE;
    await markVideoExportGenerating(id, lang);
    await exportQueue.add("export", {
      kind: "video.export",
      guideId: id,
      language: lang,
    });
    res.json({ export: await getVideoExport(id, lang) });
  }
);

// Read narration for a language — the ordered, staleness-annotated review list.
voiceRouter.get(
  "/api/guides/:id/narration",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { language } = languageQuerySchema.parse(req.query);
    await assertGuide(id, req.workspace!.id);
    const narration = await getNarration(id, language ?? BASE_LANGUAGE);
    res.json({ narration });
  }
);

// Kick off whole-guide narration generation (async). Returns immediately with
// status=generating; the editor polls until ready.
voiceRouter.post(
  "/api/guides/:id/narration/generate",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { language } = languageQuerySchema.parse(req.query);
    const { force } = generateBodySchema.parse(req.body ?? {});
    await assertGuide(id, req.workspace!.id);
    const lang = language ?? BASE_LANGUAGE;
    await markNarrationGenerating(id, lang);
    await voiceQueue.add("narration", {
      kind: "narration.generate",
      guideId: id,
      language: lang,
      force,
    });
    const narration = await getNarration(id, lang);
    res.json({ narration });
  }
);

// Render voiceover audio for the guide's narration (async, per-segment fan-out
// on the worker). Skips segments already rendered (content-addressed). Returns
// the narration view with live per-segment audio status.
voiceRouter.post(
  "/api/guides/:id/narration/audio",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { language } = languageQuerySchema.parse(req.query);
    await assertGuide(id, req.workspace!.id);
    const lang = language ?? BASE_LANGUAGE;
    const { toSynthesize } = await prepareAudioBuild(id, lang);
    await Promise.all(
      toSynthesize.map((anchorKey) =>
        voiceQueue.add("synthesize", {
          kind: "voice.synthesize",
          guideId: id,
          language: lang,
          anchorKey,
        })
      )
    );
    res.json({ narration: await getNarration(id, lang) });
  }
);

// Regenerate a single step/slide (synchronous — one quick call).
voiceRouter.post(
  "/api/guides/:id/narration/segments/:anchorKey/regenerate",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const anchorKey = z.string().parse(req.params.anchorKey);
    const { language } = languageQuerySchema.parse(req.query);
    await assertGuide(id, req.workspace!.id);
    const lang = language ?? BASE_LANGUAGE;
    try {
      await generateNarrationForGuide(id, lang, { anchorKey });
    } catch (err) {
      if (err instanceof NarrationAnchorNotFound) {
        throw new AppError(404, "NOT_FOUND", err.message);
      }
      throw err;
    }
    res.json({ narration: await getNarration(id, lang) });
  }
);

// Overwrite one segment's narration with a human edit (synchronous).
voiceRouter.patch(
  "/api/guides/:id/narration/segments/:anchorKey",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const anchorKey = z.string().parse(req.params.anchorKey);
    const { text } = editBodySchema.parse(req.body);
    const { language } = languageQuerySchema.parse(req.query);
    await assertGuide(id, req.workspace!.id);
    try {
      const narration = await editNarrationSegment(
        id,
        language ?? BASE_LANGUAGE,
        anchorKey,
        text
      );
      res.json({ narration });
    } catch (err) {
      if (err instanceof NarrationAnchorNotFound) {
        throw new AppError(404, "NOT_FOUND", err.message);
      }
      throw err;
    }
  }
);

// Remove all narration for a language.
voiceRouter.delete(
  "/api/guides/:id/narration",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { language } = languageQuerySchema.parse(req.query);
    await assertGuide(id, req.workspace!.id);
    await deleteNarration(id, language ?? BASE_LANGUAGE);
    res.json({ ok: true });
  }
);
