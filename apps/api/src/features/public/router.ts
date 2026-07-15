import { readFormDocument } from "@workspace/contracts/form";
import {
  commentInputSchema,
  reactionInputSchema,
  readFaqs,
  readGuideEmbeds,
} from "@workspace/contracts/guide";
import { ingestGuideEventsSchema } from "@workspace/contracts/guide-analytics";
import { Prisma, prisma } from "@workspace/db";
import { getPublishedNarrationByLanguage } from "@workspace/generation";
import { Router } from "express";
import { z } from "zod";

import { rateLimit } from "../../lib/rate-limit.js";
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

/** Resolve a guide's form embeds, inlining each referenced PUBLISHED form's
 *  document so the reader can fill it inline. Drops broken/unpublished refs. */
async function resolveGuideEmbeds(raw: unknown) {
  const embeds = readGuideEmbeds(raw);
  if (embeds.length === 0) return [];
  const formIds = [...new Set(embeds.map((e) => e.formId))];
  const forms = await prisma.form.findMany({
    where: { id: { in: formIds }, status: "PUBLISHED", deletedAt: null },
    select: { id: true, shareId: true, document: true, documentVersion: true },
  });
  const byId = new Map(forms.map((f) => [f.id, f]));
  return embeds.flatMap((embed) => {
    const form = byId.get(embed.formId);
    const document = form ? readFormDocument(form.document) : null;
    if (!form || !document) return [];
    return [
      {
        ...embed,
        form: {
          shareId: form.shareId,
          version: form.documentVersion,
          document,
        },
      },
    ];
  });
}

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

  // View counting moved to the client `view` beacon (deduped per session) —
  // see POST /events below. The GET no longer blind-increments viewCount.

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
      // Form overlays, each with its referenced published form inlined so the
      // reader can fill it without a second round-trip. Broken/unpublished
      // references are dropped.
      embeds: await resolveGuideEmbeds(guide.embeds),
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

/**
 * Anonymous reader-engagement beacon — a batched set of events for one viewing
 * session. Best-effort by design: rate-limited and malformed batches are
 * silently dropped (a beacon must never surface an error), and all writes are
 * fire-and-forget so they never block the response. The client dedups (one
 * `view` per session, each step once), so one `view` in a batch = one lifetime
 * viewCount increment.
 */
publicRouter.post("/api/public/guides/:shareId/events", async (req, res) => {
  const { shareId } = shareParamSchema.parse(req.params);
  const ip = req.ip ?? "unknown";
  // Generous — batching keeps a normal session well under this.
  if (!rateLimit(`gevents:${ip}:${shareId}`, 60, 60_000)) {
    res.status(204).end();
    return;
  }
  const parsed = ingestGuideEventsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(204).end();
    return;
  }
  const { anonId, sessionId, events } = parsed.data;

  const guide = await prisma.guide.findFirst({
    where: { shareId, status: "PUBLISHED", deletedAt: null },
    select: { id: true },
  });
  if (guide) {
    const rows: Prisma.GuideEventCreateManyInput[] = events.map((e) => ({
      guideId: guide.id,
      // Contract values are the lowercase of the DB enum (underscores preserved).
      type: e.type.toUpperCase() as Prisma.GuideEventCreateManyInput["type"],
      anonId,
      sessionId,
      context: e.context ? (e.context as Prisma.InputJsonValue) : Prisma.DbNull,
    }));
    void prisma.guideEvent.createMany({ data: rows }).catch(() => {});
    if (events.some((e) => e.type === "view")) {
      void prisma.guide
        .update({ where: { id: guide.id }, data: { viewCount: { increment: 1 } } })
        .catch(() => {});
    }
  }
  res.status(204).end();
});
