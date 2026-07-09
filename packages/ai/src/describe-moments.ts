import type { CaptureEvent } from "@workspace/contracts/capture";
import { Output, generateText } from "ai";
import { z } from "zod";

import { getModel } from "./model.js";
import type { TranscriptSegment } from "./transcribe-audio.js";

/**
 * Vision stage of video ingestion: for each detected visual moment
 * (before/after frames + narration window), infer what the user DID —
 * emitting the same normalized CaptureEvent the extension produces,
 * with a confidence score since this is inference, not observation.
 */

export type Moment = {
  /** Seconds into the video. */
  timeSec: number;
  beforeFrame: Uint8Array;
  afterFrame: Uint8Array;
  /** R2 key of the stored before-frame (becomes the step screenshot). */
  screenshotId: string;
};

const momentAnalysisSchema = z.object({
  meaningful: z
    .boolean()
    .describe(
      "false when the change is noise: scrolling, cursor drift, animations, video playing"
    ),
  actionType: z
    .enum(["click", "input", "navigation"])
    .nullable()
    .describe("The user action that best explains the change, or null"),
  elementText: z
    .string()
    .nullable()
    .describe("Visible label of the element acted on (button/link/field)"),
  elementRole: z
    .string()
    .nullable()
    .describe("Role of the element: button, link, textbox, menuitem…"),
  inputValue: z
    .string()
    .nullable()
    .describe("For input actions: the text that was entered, if readable"),
  pageTitle: z
    .string()
    .nullable()
    .describe("Page or screen title visible in the frames"),
  url: z.string().nullable().describe("URL visible in the address bar, if any"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How certain you are about the action (1 = unambiguous)"),
});

const SYSTEM_PROMPT = `You analyze screen recordings. You receive a BEFORE and AFTER screenshot of one moment where the screen changed, plus what the narrator was saying (when available).

Determine what user action explains the change. Be conservative: if the change is scrolling, animation, or ambient content (video playing, live data updating), mark it as not meaningful. Read visible UI text carefully — element labels must be exactly what is on screen, never guessed.`;

function narrationAround(
  transcript: TranscriptSegment[],
  timeSec: number,
  windowSec = 6
): string | null {
  const nearby = transcript.filter(
    (segment) =>
      segment.startSec <= timeSec + windowSec &&
      segment.endSec >= timeSec - windowSec
  );
  if (nearby.length === 0) return null;
  return nearby.map((segment) => segment.text).join(" ");
}

async function describeOne(
  moment: Moment,
  transcript: TranscriptSegment[]
): Promise<CaptureEvent | null> {
  const narration = narrationAround(transcript, moment.timeSec);

  const { output } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `Moment at ${moment.timeSec.toFixed(1)}s.`,
              narration ? `Narrator: "${narration}"` : "No narration.",
              "First image: BEFORE. Second image: AFTER.",
            ].join("\n"),
          },
          { type: "file", mediaType: "image/jpeg", data: moment.beforeFrame },
          { type: "file", mediaType: "image/jpeg", data: moment.afterFrame },
        ],
      },
    ],
    output: Output.object({ schema: momentAnalysisSchema }),
  });

  if (!output.meaningful || !output.actionType) return null;

  const base = {
    timestamp: Math.round(moment.timeSec * 1000),
    url: output.url ?? "",
    pageTitle: output.pageTitle ?? undefined,
    screenshotId: moment.screenshotId,
    confidence: output.confidence,
  };

  switch (output.actionType) {
    case "navigation":
      return { ...base, type: "navigation" };
    case "input":
      return {
        ...base,
        type: "input",
        target: {
          text: output.elementText ?? "field",
          role: output.elementRole ?? undefined,
        },
        value: output.inputValue ?? "",
      };
    case "click":
      return {
        ...base,
        type: "click",
        target: {
          text: output.elementText ?? "element",
          role: output.elementRole ?? undefined,
        },
      };
  }
}

/** Bounded-concurrency analysis of all moments, order preserved. */
export async function describeMoments(
  moments: Moment[],
  transcript: TranscriptSegment[],
  concurrency = 4
): Promise<CaptureEvent[]> {
  const results: (CaptureEvent | null)[] = new Array(moments.length).fill(null);
  let next = 0;

  async function runOne(): Promise<void> {
    while (next < moments.length) {
      const index = next++;
      const moment = moments[index]!;
      try {
        results[index] = await describeOne(moment, transcript);
      } catch (error) {
        // One bad moment must not sink the capture — skip it, keep going.
        console.error(
          `moment @${moment.timeSec.toFixed(1)}s failed:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, moments.length) }, runOne)
  );

  return results.filter((event): event is CaptureEvent => event !== null);
}
