import {
  createCaptureSchema,
  createExtensionCaptureSchema,
  createVideoCaptureSchema,
  screenshotUrlsSchema,
  submitCaptureSchema,
} from "@workspace/contracts/capture";
import { prisma } from "@workspace/db";
import { presignPut } from "@workspace/storage";
import { Router } from "express";
import { z } from "zod";

const idParamSchema = z.object({ id: z.string() });

import { captureQueue } from "../../lib/queue.js";
import { AppError } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";

/**
 * Captures — ingestion endpoint for every capture surface (extension,
 * video ingestion, fixtures). Creates the immutable Capture and enqueues
 * processing; the worker does the rest.
 */
export const captureRouter: Router = Router();

/** A guide is worthless without screenshots — does any event carry one? */
function eventsHaveScreenshot(events: unknown): boolean {
  return (
    Array.isArray(events) &&
    events.some(
      (e) =>
        !!e &&
        typeof e === "object" &&
        !!(e as Record<string, unknown>).screenshotId
    )
  );
}

const NO_SCREENSHOTS_MESSAGE =
  "No screenshots were captured — please record again.";

captureRouter.post(
  "/api/captures",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const input = createCaptureSchema.parse(req.body);

    const capture = await prisma.capture.create({
      data: {
        title: input.title ?? null,
        source: input.source,
        status: "PROCESSING",
        events: input.events,
        organizationId: req.workspace!.id,
        createdById: req.user!.id,
      },
    });

    await captureQueue.add("process", { captureId: capture.id });

    res.status(201).json({
      capture: {
        id: capture.id,
        status: capture.status,
        createdAt: capture.createdAt,
      },
    });
  }
);

/**
 * Video capture, step 1: create the Capture row + a presigned upload URL.
 * The browser PUTs the recording straight to R2 (never through this API),
 * then calls /complete.
 */
captureRouter.post(
  "/api/captures/video",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const input = createVideoCaptureSchema.parse(req.body);
    const extension = input.mimeType.startsWith("video/mp4") ? "mp4" : "webm";

    const capture = await prisma.capture.create({
      data: {
        title: input.title ?? null,
        source: "VIDEO_UPLOAD",
        status: "UPLOADING",
        organizationId: req.workspace!.id,
        createdById: req.user!.id,
      },
    });

    const videoKey = `captures/${req.workspace!.id}/${capture.id}/raw.${extension}`;
    await prisma.capture.update({
      where: { id: capture.id },
      data: { videoKey },
    });

    const uploadUrl = await presignPut(videoKey, input.mimeType);

    res.status(201).json({
      capture: { id: capture.id, status: "UPLOADING" },
      uploadUrl,
    });
  }
);

/** Video capture, step 2: upload finished — enqueue processing. */
captureRouter.post(
  "/api/captures/:id/complete",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const capture = await prisma.capture.findFirst({
      where: {
        id,
        organizationId: req.workspace!.id,
        deletedAt: null,
      },
    });
    if (!capture) {
      throw new AppError(404, "NOT_FOUND", "Capture not found");
    }
    if (capture.status !== "UPLOADING") {
      throw new AppError(
        409,
        "ALREADY_PROCESSED",
        "This capture has already been submitted"
      );
    }

    await prisma.capture.update({
      where: { id: capture.id },
      data: { status: "PROCESSING" },
    });
    await captureQueue.add("process", { captureId: capture.id });

    res.json({ capture: { id: capture.id, status: "PROCESSING" } });
  }
);

// ── Extension capture flow ───────────────────────────────────────────────
// Mirrors the video two-phase: create (UPLOADING) → presign screenshots →
// upload to R2 → submit events (referencing the screenshot keys). The worker
// then runs the same normalize → synthesize → assemble pipeline.

captureRouter.post(
  "/api/captures/extension",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const input = createExtensionCaptureSchema.parse(req.body);
    const capture = await prisma.capture.create({
      data: {
        title: input.title ?? null,
        source: "EXTENSION",
        status: "UPLOADING",
        organizationId: req.workspace!.id,
        createdById: req.user!.id,
      },
    });
    res.status(201).json({ captureId: capture.id });
  }
);

captureRouter.post(
  "/api/captures/:id/screenshot-urls",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { count } = screenshotUrlsSchema.parse(req.body);

    const capture = await prisma.capture.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!capture) throw new AppError(404, "NOT_FOUND", "Capture not found");
    if (capture.status !== "UPLOADING") {
      throw new AppError(409, "ALREADY_PROCESSED", "Capture already submitted");
    }

    const urls = await Promise.all(
      Array.from({ length: count }, async (_unused, index) => {
        const key = `captures/${req.workspace!.id}/${id}/shots/${index}.png`;
        return { key, uploadUrl: await presignPut(key, "image/png") };
      })
    );
    res.json({ urls });
  }
);

captureRouter.post(
  "/api/captures/:id/submit",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { events } = submitCaptureSchema.parse(req.body);

    const capture = await prisma.capture.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!capture) throw new AppError(404, "NOT_FOUND", "Capture not found");
    if (capture.status !== "UPLOADING") {
      throw new AppError(409, "ALREADY_PROCESSED", "Capture already submitted");
    }

    // Guard: never start the pipeline for a capture with no screenshots — it
    // can only yield an imageless "guide". Fail it fast + visibly instead.
    if (!eventsHaveScreenshot(events)) {
      await prisma.capture.update({
        where: { id },
        data: { events, status: "FAILED", errorMessage: NO_SCREENSHOTS_MESSAGE },
      });
      throw new AppError(422, "NO_SCREENSHOTS", NO_SCREENSHOTS_MESSAGE);
    }

    await prisma.capture.update({
      where: { id },
      data: { events, status: "PROCESSING" },
    });
    await captureQueue.add("process", { captureId: id });
    res.json({ capture: { id, status: "PROCESSING" } });
  }
);

/** In-flight captures for the home page's processing cards. */
captureRouter.get(
  "/api/captures",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const rows = await prisma.capture.findMany({
      where: {
        organizationId: req.workspace!.id,
        deletedAt: null,
        status: { in: ["UPLOADING", "PROCESSING", "FAILED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        source: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        // Needed only to decide `retryable`; not sent to the client.
        videoKey: true,
        events: true,
      },
    });

    // A FAILED capture is retryable only if reprocessing could actually
    // succeed: a video to re-ingest, or events that carry screenshots.
    // Abandoned/empty/screenshot-less captures are dismiss-only.
    const captures = rows.map(({ videoKey, events, ...c }) => ({
      ...c,
      retryable:
        c.status === "FAILED" &&
        (!!videoKey || eventsHaveScreenshot(events)),
    }));
    res.json({ captures });
  }
);

captureRouter.get(
  "/api/captures/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const capture = await prisma.capture.findFirst({
      where: {
        id,
        organizationId: req.workspace!.id, // workspace scoping — never trust the id alone
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        source: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        guides: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });
    if (!capture) {
      throw new AppError(404, "NOT_FOUND", "Capture not found");
    }
    res.json({ capture });
  }
);

/** Retry a FAILED capture that still has its source data — re-enqueue it. */
captureRouter.post(
  "/api/captures/:id/retry",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const capture = await prisma.capture.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true, status: true, videoKey: true, events: true },
    });
    if (!capture) throw new AppError(404, "NOT_FOUND", "Capture not found");
    if (capture.status !== "FAILED") {
      throw new AppError(
        409,
        "NOT_FAILED",
        "Only a failed capture can be retried"
      );
    }

    if (!capture.videoKey && !eventsHaveScreenshot(capture.events)) {
      throw new AppError(
        422,
        "NOTHING_TO_RETRY",
        "This capture has no screenshots to reprocess — please record again"
      );
    }

    await prisma.capture.update({
      where: { id },
      data: { status: "PROCESSING", errorMessage: null },
    });
    await captureQueue.add("process", { captureId: id });
    res.json({ capture: { id, status: "PROCESSING" } });
  }
);

/** Dismiss a capture (soft delete) — clears it from the home list. */
captureRouter.delete(
  "/api/captures/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const capture = await prisma.capture.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!capture) throw new AppError(404, "NOT_FOUND", "Capture not found");

    await prisma.capture.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }
);
