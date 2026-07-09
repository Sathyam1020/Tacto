import { z } from "zod";

/**
 * Capture event contracts — the normalized action log every capture surface
 * emits (extension now; video ingestion and desktop app later produce the
 * SAME shape). This schema is the platform-independent core of Tacto:
 * everything downstream (pipeline, AI, editor) consumes it.
 */

export const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

/** The interaction target, described semantically — never raw DOM. */
export const eventTargetSchema = z.object({
  /** CSS selector when known (extension); absent for video-derived events. */
  selector: z.string().optional(),
  /** ARIA-ish role: button, link, textbox, menuitem… */
  role: z.string().optional(),
  /** Visible label of the element — what the AI writes steps from. */
  text: z.string(),
  boundingBox: boundingBoxSchema.optional(),
  /** Parent/sibling context for disambiguation ("Leads toolbar"). */
  nearbyContext: z.string().optional(),
});

const eventBase = {
  /** ms — epoch for live captures, offset-into-video for imports. */
  timestamp: z.number(),
  url: z.string(),
  pageTitle: z.string().optional(),
  /** ID of the screenshot taken at this moment (R2 key, later phases). */
  screenshotId: z.string().optional(),
  /** 0–1 for inferred events (video); omitted = fully trusted (extension). */
  confidence: z.number().min(0).max(1).optional(),
};

export const clickEventSchema = z.object({
  ...eventBase,
  type: z.literal("click"),
  target: eventTargetSchema,
});

export const inputEventSchema = z.object({
  ...eventBase,
  type: z.literal("input"),
  target: eventTargetSchema,
  /** Coalesced final value. Sensitive fields arrive pre-masked ("•••"). */
  value: z.string(),
});

export const navigationEventSchema = z.object({
  ...eventBase,
  type: z.literal("navigation"),
});

export const captureEventSchema = z.discriminatedUnion("type", [
  clickEventSchema,
  inputEventSchema,
  navigationEventSchema,
]);

export type CaptureEvent = z.infer<typeof captureEventSchema>;
export type ClickEvent = z.infer<typeof clickEventSchema>;
export type InputEvent = z.infer<typeof inputEventSchema>;
export type NavigationEvent = z.infer<typeof navigationEventSchema>;

// ── API payloads ─────────────────────────────────────────────────────────

export const captureSourceSchema = z.enum([
  "EXTENSION",
  "VIDEO_UPLOAD",
  "IMPORT",
]);

export const createCaptureSchema = z.object({
  title: z.string().trim().max(200).optional(),
  source: captureSourceSchema,
  events: z
    .array(captureEventSchema)
    .min(1, "A capture needs at least one event")
    .max(2000, "Capture is too large"),
});

export type CreateCaptureInput = z.infer<typeof createCaptureSchema>;

/** Video capture: create → presigned PUT → browser uploads → complete. */
export const createVideoCaptureSchema = z.object({
  title: z.string().trim().max(200).optional(),
  mimeType: z
    .string()
    .regex(/^video\/(webm|mp4)(;.*)?$/, "Unsupported recording format"),
});

export type CreateVideoCaptureInput = z.infer<typeof createVideoCaptureSchema>;

/** Hard product limit — enforced client-side (auto-stop) and by ffprobe. */
export const MAX_CAPTURE_DURATION_SEC = 300;

// ── Queue contract (shared by api producer and worker consumer) ──────────

export const CAPTURE_QUEUE = "capture-process";

export type CaptureJobData = {
  captureId: string;
};

// ── Synthesis output (shared by packages/ai and the worker) ─────────────

export const synthesizedStepSchema = z.object({
  instruction: z
    .string()
    .describe(
      "One imperative sentence telling the reader exactly what to do"
    ),
  // nullable (not optional): OpenAI strict structured outputs require every
  // property to be present — absence is expressed as null.
  elementLabel: z
    .string()
    .nullable()
    .describe("Visible label of the UI element acted on, or null"),
  url: z.string().nullable().describe("Page URL this step happens on, or null"),
  sourceEventIndexes: z
    .array(z.number())
    .describe("Indexes into the input event log this step was derived from"),
});

export const synthesizedGuideSchema = z.object({
  title: z
    .string()
    .describe("Short task-oriented title, e.g. 'Create a new customer'"),
  summary: z
    .string()
    .describe("One or two sentences on what this guide accomplishes"),
  steps: z.array(synthesizedStepSchema).min(1),
});

export type SynthesizedGuide = z.infer<typeof synthesizedGuideSchema>;
export type SynthesizedStep = z.infer<typeof synthesizedStepSchema>;
