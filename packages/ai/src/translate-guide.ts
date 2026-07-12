import {
  guideTranslationAiSchema,
  type GuideTranslationAi,
} from "@workspace/contracts/guide";
import { Output, generateText } from "ai";

import { getModel } from "./model.js";

/**
 * Translate a guide's text into a target language, preserving the block HTML
 * (tags stay; only human-readable text is translated). Screenshots and layout
 * are language-independent, so only title, summary, and per-block content are
 * translated — each block keyed by its id so the reader can overlay them.
 */
const SYSTEM_PROMPT = `You are an expert technical translator. Translate a step-by-step guide into the requested language for a native reader.

Rules:
- Translate the title, the summary, and each block's content.
- Each block's content is HTML. Preserve ALL tags and structure exactly (e.g. <p>, <strong>); translate only the visible text between tags. Do not add, remove, or reorder tags.
- Return every block using the SAME id you were given.
- Keep UI element names natural for the target language, but do not translate product/brand names, code, URLs, or values that would not be localized.
- Match the guide's concise, imperative tone. Do not add or drop information.`;

export async function translateGuide(
  content: {
    title: string;
    summary: string | null;
    blocks: { id: string; content: string }[];
  },
  languageName: string
): Promise<GuideTranslationAi> {
  const { output } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    prompt: [
      `Target language: ${languageName}`,
      "",
      "Guide (JSON):",
      JSON.stringify(content),
    ].join("\n"),
    output: Output.object({ schema: guideTranslationAiSchema }),
  });
  return output;
}
