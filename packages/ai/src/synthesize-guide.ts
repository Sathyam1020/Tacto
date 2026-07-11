import {
  synthesizedGuideSchema,
  type CaptureEvent,
  type Interaction,
  type SynthesizedGuide,
} from "@workspace/contracts/capture";
import { Output, generateText } from "ai";

import { getModel } from "./model.js";

/**
 * The core transformation: a compiled INTERACTION list → a human-quality guide.
 * The recorder + Interaction Compiler have already grouped raw browser events
 * into meaningful user actions (e.g. a click and the navigation it caused are
 * one interaction), so the model documents interactions — not browser events.
 * This prompt is Tacto's most valuable artifact — iterate it deliberately, and
 * never let the model invent actions that are not in the log.
 */

const SYSTEM_PROMPT = `You are Tacto, an expert technical writer who turns a recorded workflow into a clear step-by-step guide.

You receive an ordered list of INTERACTIONS — meaningful user actions already distilled from raw browser events (a click and the page it navigated to are one interaction, not two). Each interaction includes the element's visible label and page context. Write the guide a colleague would follow to repeat the workflow.

Rules:
- Write EXACTLY ONE step per interaction, in order — one interaction is one step is one screenshot. NEVER merge interactions or combine multiple actions ("do X and then Y") into a single step; each step is one action.
- Each step is a short imperative sentence. Bold the element labels with markdown ("Click **New customer** in the top-right.").
- Write for the READER doing the task, describing the flow — not a literal transcript of events. You may choose the VERB by intent (a click that opens a page → "Open the **Pricing** page"), but the ELEMENT'S IDENTITY must come only from the captured label. Never rename, substitute, or invent a different element, and never take the identity from surrounding page context.
- If a label is marked [low-confidence], or is a bare/generic description, keep the instruction generic ("Click the icon button in the top-right") rather than inventing a specific name. Accuracy over polish.
- An interaction annotated "→ navigates to X" already includes that navigation — do NOT add a separate "Go to X" step for it.
- NEVER invent an action that is not in the list. Accuracy over polish.
- Masked values ("•••") are sensitive — refer to them by field name ("Enter the password"), never by value.
- For each step, report the interaction index/indexes it came from (0-based, from the list below) in sourceIndexes.
- Title: short and task-oriented. Summary: one or two sentences on what the workflow accomplishes.`;

function describeEvent(event: CaptureEvent): string {
  switch (event.type) {
    case "click": {
      const ctx = event.target.nearbyContext
        ? ` in ${event.target.nearbyContext}`
        : "";
      const low =
        event.confidence != null && event.confidence < 0.5
          ? " [low-confidence]"
          : "";
      return `CLICK "${event.target.text}" (${
        event.target.role ?? "element"
      })${ctx} — on ${event.pageTitle ?? event.url}${low}`;
    }
    case "input":
      return `INPUT "${event.value}" into "${event.target.text}" (${
        event.target.role ?? "field"
      }) — on ${event.pageTitle ?? event.url}`;
    case "navigation":
      return `NAVIGATE to ${
        event.pageTitle ? `"${event.pageTitle}" (${event.url})` : event.url
      }`;
  }
}

function formatInteractions(
  events: CaptureEvent[],
  interactions: Interaction[]
): string {
  return interactions
    .map((ix, index) => {
      const primary = events[ix.primaryEventIndex];
      if (!primary) return `${index}. (unknown)`;
      const nav = ix.absorbedNavigation
        ? ` → navigates to ${
            ix.absorbedNavigation.pageTitle ?? ix.absorbedNavigation.url
          }`
        : "";
      return `${index}. ${describeEvent(primary)}${nav}`;
    })
    .join("\n");
}

export async function synthesizeGuide(
  events: CaptureEvent[],
  interactions: Interaction[],
  context?: { captureTitle?: string }
): Promise<SynthesizedGuide> {
  const { output } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    prompt: [
      context?.captureTitle
        ? `The user titled this recording: "${context.captureTitle}"`
        : null,
      "Interaction list:",
      formatInteractions(events, interactions),
    ]
      .filter(Boolean)
      .join("\n\n"),
    output: Output.object({ schema: synthesizedGuideSchema }),
  });

  return output;
}
