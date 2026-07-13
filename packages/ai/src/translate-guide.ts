import {
  guideTranslationAiSchema,
  translateStringsAiSchema,
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
- Translate the title, the summary, each block's content, and each interactive string.
- Each block's content is HTML. Preserve ALL tags and structure exactly (e.g. <p>, <strong>); translate only the visible text between tags. Do not add, remove, or reorder tags.
- The "interactive" strings are the walkthrough's callouts (HTML), slide titles/subtitles, and button labels. Same rules: preserve any HTML tags; translate only the visible text.
- Return every block and every interactive string using the SAME id you were given.
- Keep UI element names natural for the target language, but do not translate product/brand names, code, URLs, or values that would not be localized.
- Match the guide's concise, imperative tone. Do not add or drop information.`;

export async function translateGuide(
  content: {
    title: string;
    summary: string | null;
    blocks: { id: string; content: string }[];
    interactive: { id: string; content: string }[];
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

const STRINGS_SYSTEM_PROMPT = `You are an expert technical translator. Translate a set of id-keyed strings from a step-by-step guide into the requested language for a native reader.

Rules:
- Some strings are HTML (step callouts, block content). Preserve ALL tags and structure exactly (e.g. <p>, <strong>); translate only the visible text between tags. Do not add, remove, or reorder tags.
- Other strings are plain text (slide titles/subtitles, button labels). Translate the text; add no markup.
- Return every string using the SAME id you were given.
- Keep UI element names natural for the target language, but do not translate product/brand names, code, URLs, or values that would not be localized.
- Match the guide's concise, imperative tone. Do not add or drop information.`;

/**
 * Translate a bag of id-keyed strings into a target language. The primitive
 * behind per-step re-translation (and any focused re-translate). Returns the
 * strings translated, keyed by the SAME ids. An empty input skips the model.
 */
export async function translateStrings(
  strings: { id: string; content: string }[],
  languageName: string
): Promise<{ id: string; content: string }[]> {
  if (strings.length === 0) return [];
  const { output } = await generateText({
    model: getModel(),
    system: STRINGS_SYSTEM_PROMPT,
    prompt: [
      `Target language: ${languageName}`,
      "",
      "Strings (JSON):",
      JSON.stringify({ strings }),
    ].join("\n"),
    output: Output.object({ schema: translateStringsAiSchema }),
  });
  return output.strings;
}
