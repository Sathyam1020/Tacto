import { prisma } from "@workspace/db";
import { Router } from "express";
import { z } from "zod";

import { sanitizeContent } from "../../lib/sanitize.js";
import { AppError } from "../../middleware/error.js";
import { blockSelect, serializeBlocks } from "../guide/serialize.js";

/**
 * Public, unauthenticated guide access by shareId. Mounted WITHOUT the auth
 * middleware. Only PUBLISHED guides are visible; content is re-sanitized on
 * read as defense in depth.
 */
export const publicRouter: Router = Router();

const shareParamSchema = z.object({ shareId: z.string().min(1) });

publicRouter.get("/api/public/guides/:shareId", async (req, res) => {
  const { shareId } = shareParamSchema.parse(req.params);

  const guide = await prisma.guide.findFirst({
    where: { shareId, status: "PUBLISHED", deletedAt: null },
    include: {
      organization: { select: { name: true } },
      blocks: { orderBy: { position: "asc" }, select: blockSelect },
    },
  });
  if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

  // Fire-and-forget view count; never block the response on it.
  void prisma.guide
    .update({ where: { id: guide.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  const blocks = await serializeBlocks(guide.blocks);

  res.json({
    guide: {
      title: guide.title,
      summary: guide.summary,
      workspaceName: guide.organization.name,
      publishedAt: guide.publishedAt,
      blocks: blocks.map((block) => ({
        ...block,
        content: sanitizeContent(block.content),
      })),
    },
  });
});
