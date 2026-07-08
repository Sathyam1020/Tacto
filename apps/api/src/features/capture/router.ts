import { createCaptureSchema } from "@workspace/contracts/capture";
import { prisma } from "@workspace/db";
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
