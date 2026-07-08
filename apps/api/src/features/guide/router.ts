import { prisma } from "@workspace/db";
import { Router } from "express";
import { z } from "zod";

const idParamSchema = z.object({ id: z.string() });

import { AppError } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";

/** Guides — workspace-scoped reads. Editing arrives with the editor phase. */
export const guideRouter: Router = Router();

guideRouter.get(
  "/api/guides",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const guides = await prisma.guide.findMany({
      where: {
        organizationId: req.workspace!.id,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        summary: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { steps: true } },
      },
    });

    res.json({
      guides: guides.map((guide) => ({
        id: guide.id,
        title: guide.title,
        summary: guide.summary,
        status: guide.status,
        stepCount: guide._count.steps,
        createdAt: guide.createdAt,
        updatedAt: guide.updatedAt,
      })),
    });
  }
);

guideRouter.get(
  "/api/guides/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: {
        id,
        organizationId: req.workspace!.id, // workspace scoping
        deletedAt: null,
      },
      include: {
        steps: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            position: true,
            instruction: true,
            elementLabel: true,
            url: true,
            screenshotUrl: true,
            confidence: true,
          },
        },
      },
    });
    if (!guide) {
      throw new AppError(404, "NOT_FOUND", "Guide not found");
    }

    res.json({
      guide: {
        id: guide.id,
        title: guide.title,
        summary: guide.summary,
        status: guide.status,
        createdAt: guide.createdAt,
        steps: guide.steps,
      },
    });
  }
);
