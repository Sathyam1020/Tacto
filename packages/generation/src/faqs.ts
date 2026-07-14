import { generateFaqs } from "@workspace/ai";
import type { Faq } from "@workspace/contracts/guide";
import { prisma } from "@workspace/db";

import {
  guideContentSelect,
  resolveGuideContent,
  stripHtml,
} from "./guide-source.js";

/**
 * FAQ domain — the one AI touchpoint. FAQs themselves live in the draft document
 * (edited + published like slides), so there is no persistence here: generation
 * reads the guide's current content (draft-aware) and returns AI-authored FAQs
 * for the editor to stage into the draft. `source` is stamped "ai".
 */
export async function generateGuideFaqs(
  guideId: string,
  opts: { count: number; avoid: string[] }
): Promise<Faq[]> {
  if (opts.count <= 0) return [];
  const guide = await prisma.guide.findUnique({
    where: { id: guideId },
    select: guideContentSelect,
  });
  if (!guide) return [];

  const { title, summary, blocks } = resolveGuideContent(guide);
  const steps = blocks
    .filter((b) => b.type === "STEP")
    .map((b) => stripHtml(b.content))
    .filter(Boolean);
  if (steps.length === 0) return [];

  const raw = await generateFaqs(
    { title, summary, steps },
    { count: opts.count, avoid: opts.avoid }
  );
  return raw
    .map((f) => ({
      question: f.question.trim(),
      answer: f.answer.trim(),
      source: "ai" as const,
    }))
    .filter((f) => f.question.length > 0 && f.answer.length > 0)
    .slice(0, opts.count);
}
