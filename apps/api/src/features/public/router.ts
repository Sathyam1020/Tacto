import {
  commentInputSchema,
  reactionInputSchema,
  readFaqs,
} from "@workspace/contracts/guide";
import { prisma } from "@workspace/db";
import { getPublishedNarrationByLanguage } from "@workspace/generation";
import { Router } from "express";
import { z } from "zod";

import { sanitizeContent } from "../../lib/sanitize.js";
import { AppError } from "../../middleware/error.js";
import {
  blockSelect,
  serializeBlocks,
  serializeCustomization,
  serializeInteractive,
} from "../guide/serialize.js";

/** Aggregate reaction counts for a guide, as `[{ emoji, count }]`. */
async function reactionCounts(guideId: string) {
  const grouped = await prisma.guideReaction.groupBy({
    by: ["emoji"],
    where: { guideId },
    _count: { emoji: true },
  });
  return grouped.map((g) => ({ emoji: g.emoji, count: g._count.emoji }));
}

/** Feedback flags off a guide's stored customization JSON. */
function feedbackFlags(customization: unknown): {
  allowReactions: boolean;
  allowComments: boolean;
} {
  const f = (customization as { feedback?: unknown } | null)?.feedback as
    | { allowReactions?: boolean; allowComments?: boolean }
    | undefined;
  return {
    allowReactions: !!f?.allowReactions,
    allowComments: !!f?.allowComments,
  };
}

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

  const { allowReactions, allowComments } = feedbackFlags(guide.customization);
  const [blocks, interactive, reactions, comments, translations, narration] =
    await Promise.all([
      serializeBlocks(guide.blocks),
      serializeInteractive(guide.interactive),
    allowReactions ? reactionCounts(guide.id) : Promise.resolve([]),
    allowComments
      ? prisma.guideComment.findMany({
          where: { guideId: guide.id },
          orderBy: { createdAt: "asc" },
          take: 200,
          select: { id: true, authorName: true, body: true, createdAt: true },
        })
      : Promise.resolve([]),
    prisma.guideTranslation.findMany({
      where: { guideId: guide.id, published: true },
      orderBy: { language: "asc" },
      select: {
        language: true,
        title: true,
        summary: true,
        steps: true,
        interactive: true,
      },
    }),
    // Published voiceover audio per language for walkthrough playback.
    getPublishedNarrationByLanguage(guide.id),
  ]);

  res.json({
    guide: {
      shareId,
      title: guide.title,
      summary: guide.summary,
      workspaceName: guide.organization.name,
      publishedAt: guide.publishedAt,
      customization: await serializeCustomization(guide.customization),
      reactions,
      comments,
      translations,
      blocks: blocks.map((block) => ({
        ...block,
        content: sanitizeContent(block.content),
      })),
      // The Interactive presentation carries slides (plain text — React escapes)
      // + per-step overrides; step content/screenshots come from `blocks`.
      interactive,
      // Voiceover audio per anchor (presigned) for walkthrough playback.
      narration,
      // Published FAQ list (plain text — React escapes).
      faqs: readFaqs(guide.faqs),
    },
  });
});

/** Look up a published guide by shareId (for feedback writes). */
async function findPublishedGuide(shareId: string) {
  const guide = await prisma.guide.findFirst({
    where: { shareId, status: "PUBLISHED", deletedAt: null },
    select: { id: true, customization: true },
  });
  if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");
  return guide;
}

// Toggle a reaction (anonymous, keyed by a client-generated anonId).
publicRouter.post(
  "/api/public/guides/:shareId/reactions",
  async (req, res) => {
    const { shareId } = shareParamSchema.parse(req.params);
    const { emoji, anonId } = reactionInputSchema.parse(req.body);
    const guide = await findPublishedGuide(shareId);
    if (!feedbackFlags(guide.customization).allowReactions) {
      throw new AppError(403, "FORBIDDEN", "Reactions are disabled");
    }

    const existing = await prisma.guideReaction.findUnique({
      where: { guideId_anonId_emoji: { guideId: guide.id, anonId, emoji } },
      select: { id: true },
    });
    if (existing) {
      await prisma.guideReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.guideReaction.create({
        data: { guideId: guide.id, anonId, emoji },
      });
    }

    res.json({ reactions: await reactionCounts(guide.id), reacted: !existing });
  }
);

// Post a comment (named; authorId null for anonymous public commenters).
publicRouter.post("/api/public/guides/:shareId/comments", async (req, res) => {
  const { shareId } = shareParamSchema.parse(req.params);
  const { authorName, body } = commentInputSchema.parse(req.body);
  const guide = await findPublishedGuide(shareId);
  if (!feedbackFlags(guide.customization).allowComments) {
    throw new AppError(403, "FORBIDDEN", "Comments are disabled");
  }

  const comment = await prisma.guideComment.create({
    data: { guideId: guide.id, authorName, body, authorId: null },
    select: { id: true, authorName: true, body: true, createdAt: true },
  });
  res.json({ comment });
});
