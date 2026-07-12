import { draftDocumentSchema, type DraftDocument } from "@workspace/contracts/guide";
import { Prisma, prisma } from "@workspace/db";
import { z } from "zod";

import { sanitizeContent } from "../../lib/sanitize.js";

/** Thrown when a concurrent publish already consumed the draft. Rolls the
 *  transaction back; the caller treats it as a successful no-op (the winner
 *  applied the same draft). */
class SupersededError extends Error {}

/**
 * Apply a draft document to the guide's PUBLISHED content: title, summary,
 * customization, and blocks reconciled by stable `key` (so a block's identity
 * survives a publish — translations and per-step data keep pointing at it).
 * Content only — never touches status/shareId/publishedAt; visibility is a
 * separate action (Share).
 */
async function applyDraftContent(
  tx: Prisma.TransactionClient,
  guideId: string,
  doc: DraftDocument
): Promise<void> {
  await tx.guide.update({
    where: { id: guideId },
    data: {
      title: doc.title.trim() || "Untitled guide",
      summary: doc.summary,
      customization: doc.customization,
    },
  });

  // Delete blocks whose key is gone; upsert the rest by key (preserving id).
  const keptKeys = doc.blocks.map((b) => b.key);
  await tx.step.deleteMany({
    where: {
      guideId,
      ...(keptKeys.length > 0 ? { key: { notIn: keptKeys } } : {}),
    },
  });

  for (let i = 0; i < doc.blocks.length; i++) {
    const b = doc.blocks[i]!;
    const data = {
      type: b.type,
      position: i + 1,
      content: sanitizeContent(b.content),
      screenshotUrl: b.screenshotKey ?? null, // column stores the key
      elementLabel: b.elementLabel ?? null,
      url: b.url ?? null,
      clickRect: b.clickRect ?? undefined,
      confidence: b.confidence ?? null,
    };
    await tx.step.upsert({
      where: { guideId_key: { guideId, key: b.key } },
      create: { guideId, key: b.key, ...data },
      update: data,
    });
  }

  await tx.guideTranslation.updateMany({
    where: { guideId },
    data: { published: true },
  });
}

/**
 * Publish the guide's draft: apply it to published content and delete the draft
 * atomically. The draft delete is version-guarded, so two concurrent publishes
 * can't double-apply — the loser rolls back and returns as a no-op.
 */
export async function publishDraft(guideId: string): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        const draft = await tx.guideDraft.findUnique({
          where: { guideId },
          select: { document: true, version: true },
        });
        if (!draft) return; // already published — nothing to do

        const parsed = draftDocumentSchema.safeParse(draft.document);
        if (!parsed.success) {
          // A malformed draft can't be applied — discard it, leaving the
          // published guide unchanged, rather than crashing the publish.
          console.error(
            `[guide ${guideId}] publish: draft parse failed, discarding:`,
            z.prettifyError(parsed.error)
          );
          await tx.guideDraft.deleteMany({ where: { guideId } });
          return;
        }
        await applyDraftContent(tx, guideId, parsed.data);

        const del = await tx.guideDraft.deleteMany({
          where: { guideId, version: draft.version },
        });
        if (del.count === 0) throw new SupersededError();
      },
      // Large guides upsert many blocks — give the interactive transaction room.
      { timeout: 30_000, maxWait: 10_000 }
    );
  } catch (err) {
    if (err instanceof SupersededError) return; // concurrent publish applied it
    throw err;
  }
}
