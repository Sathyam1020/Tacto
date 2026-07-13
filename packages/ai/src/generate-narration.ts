import {
  narrationAiSchema,
  type NarrationAi,
} from "@workspace/contracts/voice";
import { Output, generateText } from "ai";

import { getModel } from "./model.js";

/**
 * Narration scriptwriting. Turns a guide's on-screen steps/slides into natural
 * *spoken* narration — the voiceover script, not the terse on-screen text.
 * Narration is the canonical source of truth; audio is rendered from it later.
 *
 * Each segment is returned by the SAME anchorKey it was given so the caller can
 * store it against the stable Step/slide key.
 */
const SYSTEM_PROMPT = `You are a professional voiceover scriptwriter for software walkthrough videos.

You are given a guide's steps and slides in order, each with an anchorKey and its on-screen text. Write the spoken narration a friendly human presenter would say for each one.

Rules:
- Return one narration string per segment, using the SAME anchorKey you were given. Return every segment.
- Spoken style, not on-screen style: expand terse instructions ("Click New") into natural speech ("Now, click the New button to start a fresh form."). One to two short sentences each.
- Second person, warm and clear. It must flow as a continuous voiceover across the sequence — vary connective words (first, next, then, after that) naturally; don't start every line the same way.
- Describe the action; do not invent UI, data, or outcomes that aren't in the source text.
- Write the narration IN the requested language. Do not translate product/brand names, code, URLs, or values that would not be localized; keep UI element names natural for that language.
- Plain text only — no markdown, no HTML, no stage directions or quotes around the text.`;

export async function generateNarration(
  content: {
    title: string;
    summary: string | null;
    segments: { anchorKey: string; source: string }[];
  },
  opts: { languageName: string; style?: string | null }
): Promise<NarrationAi["segments"]> {
  if (content.segments.length === 0) return [];
  const styleLine = opts.style
    ? `Narration style: ${opts.style}.`
    : "Narration style: friendly and professional.";
  const { output } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    prompt: [
      `Language: ${opts.languageName}`,
      styleLine,
      "",
      "Guide (JSON):",
      JSON.stringify({
        title: content.title,
        summary: content.summary,
        segments: content.segments.map((s) => ({
          anchorKey: s.anchorKey,
          text: s.source,
        })),
      }),
    ].join("\n"),
    output: Output.object({ schema: narrationAiSchema }),
  });
  return output.segments;
}
