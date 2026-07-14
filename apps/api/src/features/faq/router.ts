import { prisma } from "@workspace/db";
import { generateGuideFaqs } from "@workspace/generation";
import { Router } from "express";
import { z } from "zod";

import { AppError } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";

/**
 * FAQ — the single AI touchpoint. FAQs live in the draft document (edited +
 * published like slides), so there is no persistence here: this endpoint returns
 * AI-authored suggestions for the editor to stage into the draft. `count` is the
 * number of slots to fill (bulk = remaining slots; regenerate-one = 1); `avoid`
 * is the set of existing questions the model must not duplicate.
 */
export const faqRouter: Router = Router();

const idParamSchema = z.object({ id: z.string() });
const generateBodySchema = z.object({
  // The AI authors at most 5 FAQs per guide.
  count: z.number().int().min(1).max(5),
  // Existing questions the model must not duplicate (user FAQs / other FAQs).
  avoid: z.array(z.string()).max(30).default([]),
});

async function assertGuide(guideId: string, workspaceId: string): Promise<void> {
  const guide = await prisma.guide.findFirst({
    where: { id: guideId, organizationId: workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");
}

faqRouter.post(
  "/api/guides/:id/faqs/generate",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { count, avoid } = generateBodySchema.parse(req.body);
    await assertGuide(id, req.workspace!.id);
    res.json({ faqs: await generateGuideFaqs(id, { count, avoid }) });
  }
);
