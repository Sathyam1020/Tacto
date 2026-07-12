import { importedDocSchema, type ImportedDoc } from "@workspace/contracts/guide";
import { Output, generateText } from "ai";

import { getModel } from "./model.js";

/**
 * Turn the raw text of an uploaded document (a Word doc or PDF exported to
 * text) into an ordered list of guide blocks. The document is usually already
 * a procedure — numbered steps, bullet lists, or short paragraphs — so the job
 * is to normalize it into clean, one-action steps, preserving section titles
 * as headings. Never invent steps that aren't in the document.
 */
const SYSTEM_PROMPT = `You are Tacto, an expert technical writer. You receive the raw text of a document (a Word doc or PDF) that describes a procedure. Convert it into an ordered list of guide blocks.

Rules:
- Output blocks in document order. Each block is either a STEP (one action the reader performs) or a HEADING (a short section title).
- STEP: a single imperative sentence describing ONE action. Split "do X and then Y" into two steps. Strip leading numbering/bullets ("1.", "-", "•") — the app numbers steps itself.
- HEADING: only for real section titles already present in the document. Do not invent headings.
- Use plain text only — no markdown, asterisks, or HTML.
- Preserve the document's wording and intent. NEVER invent steps, values, or details that are not in the text. Drop tables of contents, page numbers, headers/footers, and other non-procedural noise.
- If the document contains no procedure, return an empty blocks array.`;

export async function importStepsFromText(text: string): Promise<ImportedDoc> {
  // Guard against enormous documents blowing the context — the first ~24k
  // characters cover any realistic procedure.
  const trimmed = text.slice(0, 24_000);
  const { output } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    prompt: `Document text:\n\n${trimmed}`,
    output: Output.object({ schema: importedDocSchema }),
  });
  return output;
}
