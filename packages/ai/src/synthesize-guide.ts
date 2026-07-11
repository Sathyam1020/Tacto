import {
  synthesizedGuideSchema,
  type CaptureEvent,
  type SynthesizedGuide,
} from "@workspace/contracts/capture";
import { Output, generateText } from "ai";

import { getModel } from "./model.js";

/**
 * The core transformation: a normalized action log → a human-quality guide.
 * This prompt is Tacto's most valuable artifact — iterate it deliberately,
 * and never let the model invent actions that are not in the log.
 */

const SYSTEM_PROMPT = `You are Tacto, an expert technical writer who turns recorded user actions into clear step-by-step guides.

You receive an ordered log of real user actions (clicks, text inputs, page navigations) recorded while someone performed a workflow in a web app. Each event includes the element's visible label and page context.

Write the guide a colleague would follow to repeat the workflow.

Rules:
- Produce EXACTLY ONE step per user action (one click, one text entry, one navigation). NEVER combine two clicks — or a click and an input — into a single step. Each step must map to a single source event.
- Keep EVERY real action. Do not merge, summarize, or omit steps. When in doubt, keep it — a slightly redundant step is far better than a missing one.
- Every step is ONE imperative sentence ("Click **New customer** in the top-right."). Bold the element labels with markdown.
- NEVER invent an action that is not in the log. Accuracy over completeness.
- Navigations become steps like "Go to the **Customers** page" — use the page TITLE or a short page name. NEVER paste a long or query-string URL into the instruction; refer to the page by its name.
- Only drop an action that is CLEARLY noise: a click immediately undone, or an obvious dead click with no effect. Never drop an action just because it seems minor.
- Masked values ("•••") are sensitive — refer to them by field name ("Enter the password"), never by value.
- For each step, report the SINGLE event index (0-based, from the input log) it came from in sourceEventIndexes (usually one element).
- Title: short and task-oriented. Summary: one or two sentences on what the workflow accomplishes.`;

function formatEvents(events: CaptureEvent[]): string {
  return events
    .map((event, index) => {
      switch (event.type) {
        case "click":
          return `${index}. CLICK "${event.target.text}" (${event.target.role ?? "element"})${event.target.nearbyContext ? ` in ${event.target.nearbyContext}` : ""} — on ${event.pageTitle ?? event.url}`;
        case "input":
          return `${index}. INPUT "${event.value}" into "${event.target.text}" (${event.target.role ?? "field"}) — on ${event.pageTitle ?? event.url}`;
        case "navigation":
          return `${index}. NAVIGATE to ${event.pageTitle ? `"${event.pageTitle}" (${event.url})` : event.url}`;
      }
    })
    .join("\n");
}

export async function synthesizeGuide(
  events: CaptureEvent[],
  context?: { captureTitle?: string }
): Promise<SynthesizedGuide> {
  const { output } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    prompt: [
      context?.captureTitle
        ? `The user titled this recording: "${context.captureTitle}"`
        : null,
      "Recorded action log:",
      formatEvents(events),
    ]
      .filter(Boolean)
      .join("\n\n"),
    output: Output.object({ schema: synthesizedGuideSchema }),
  });

  return output;
}
