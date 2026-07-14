import { faqAiSchema, type FaqAiOutput } from "@workspace/contracts/guide";
import { Output, generateText } from "ai";

import { getModel } from "./model.js";

/**
 * FAQ generation for a guide. Produces the questions a reader would naturally
 * ask *after* following the guide — about outcomes, consequences, prerequisites
 * and "what if" cases — not restatements of the steps. Answers are grounded
 * strictly in the guide's content (no invented UI, data, or claims).
 *
 * `source` is NOT set by the model; the caller stamps it ("ai").
 */
const SYSTEM_PROMPT = `You write a concise FAQ for the readers of a how-to guide.

You are given a guide (title, summary, and its ordered steps). Produce the questions a thoughtful reader would still wonder about AFTER reading it, with clear answers.

What makes a GOOD FAQ question:
- It anticipates something the steps do not spell out: an outcome, consequence, reversibility, prerequisite, limit, or "what happens next / what if" case.
- Examples of the right shape: "What happens after I publish?", "Can I edit this later?", "Will my changes be visible before I publish?", "What if I don't have permission?"

What to AVOID (these are BAD):
- Questions that merely restate a step as a question: "How do I click Publish?", "How do I open the menu?". If the answer is literally "follow step N", do not ask it.
- Duplicates or near-duplicates of each other or of the provided existing questions.
- Generic filler ("Is this hard?", "Why should I use this?") and marketing.
- Repeating the guide back to the reader.

Rules:
- Ground every answer in the guide's content. Do NOT invent UI, features, data, values, or claims that are not supported by the guide. If a natural question cannot be answered from the guide, OMIT it rather than guessing.
- Return between 1 and {MAX} FAQs. Choose the count by how much the guide genuinely warrants — a short/simple guide may only support 1–2 good questions. NEVER pad to reach the maximum.
- Each question ≤ 15 words. Each answer is 1–3 plain sentences (no markdown, no HTML).`;

export async function generateFaqs(
  content: { title: string; summary: string | null; steps: string[] },
  opts: { count: number; avoid: string[] }
): Promise<FaqAiOutput["faqs"]> {
  if (opts.count <= 0 || content.steps.length === 0) return [];
  const { output } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT.replace("{MAX}", String(opts.count)),
    prompt: [
      `Generate up to ${opts.count} FAQ${opts.count === 1 ? "" : "s"}.`,
      opts.avoid.length > 0
        ? `Do NOT repeat or paraphrase any of these existing questions:\n${opts.avoid.map((q) => `- ${q}`).join("\n")}`
        : "",
      "",
      "Guide (JSON):",
      JSON.stringify({
        title: content.title,
        summary: content.summary,
        steps: content.steps,
      }),
    ]
      .filter(Boolean)
      .join("\n"),
    output: Output.object({ schema: faqAiSchema }),
  });
  return output.faqs.slice(0, opts.count);
}
