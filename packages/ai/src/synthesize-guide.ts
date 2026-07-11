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
- Write ONE clear step per interaction, in order. You MAY merge two ADJACENT interactions into a single sentence when they form one natural task — e.g. entering a search term and clicking the result → "Search for **John** and open his profile." Never drop a distinct action, and never combine unrelated interactions.
- Each step is a short imperative sentence. Bold the element labels with markdown ("Click **New customer** in the top-right.").
- Write for the READER doing the task, describing the flow — not a literal transcript of events. Prefer intent: a click that opens a page becomes "Open the **Pricing** page", a click that opens a dialog becomes "Open **Settings**".
- An interaction annotated "→ navigates to X" already includes that navigation — do NOT add a separate "Go to X" step for it.
- NEVER invent an action that is not in the list. Accuracy over polish.
- Masked values ("•••") are sensitive — refer to them by field name ("Enter the password"), never by value.
- For each step, report the interaction index/indexes it came from (0-based, from the list below) in sourceIndexes.
- Title: short and task-oriented. Summary: one or two sentences on what the workflow accomplishes.`;

function describeEvent(event: CaptureEvent): string {
  switch (event.type) {
    case "click":
      return `CLICK "${event.target.text}" (${event.target.role ?? "element"})${
        event.target.nearbyContext ? ` in ${event.target.nearbyContext}` : ""
      } — on ${event.pageTitle ?? event.url}`;
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
