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

/** Viewport size (CSS px) at capture time — normalizes boundingBox to 0–1. */
export const viewportSchema = z.object({
  w: z.number().positive(),
  h: z.number().positive(),
});

/** Normalized click rectangle (0–1 of the screenshot) for the pointer. */
export const clickRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export type ClickRect = z.infer<typeof clickRectSchema>;

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

/**
 * Candidate screenshots for one event. `before` = the pre-interaction frame
 * ("where to act"); `after` = the post-settle frame ("what happened"), present
 * only when the interaction changed the DOM. The frame-selection stage resolves
 * these down to a single `screenshotId`.
 */
export const framesSchema = z.object({
  before: z.string().optional(),
  after: z.string().optional(),
});
export type Frames = z.infer<typeof framesSchema>;

/**
 * Factual DOM-settle observations recorded by the content script — NOT
 * decisions. The deterministic selector interprets these; the recorder never
 * chooses a frame itself.
 */
export const settleSchema = z.object({
  /** Did any non-pill DOM mutation occur in the settle window? */
  mutated: z.boolean(),
  /** A dialog/menu/listbox/tooltip node appeared (modal-ish result). */
  overlayAppeared: z.boolean().optional(),
  /** The URL changed during the settle window. */
  urlChanged: z.boolean().optional(),
});
export type Settle = z.infer<typeof settleSchema>;

const eventBase = {
  /** ms — epoch for live captures, offset-into-video for imports. */
  timestamp: z.number(),
  url: z.string(),
  pageTitle: z.string().optional(),
  /**
   * The RESOLVED screenshot for this event (R2 key). Written by the recorder
   * for legacy single-frame captures, and (re)written by the worker's frame
   * selector for multi-frame captures. The sole field the renderer/assembler
   * reads — keeping it means zero downstream change + backward compatibility.
   */
  screenshotId: z.string().optional(),
  /** Candidate frames (before/after). Absent on legacy single-frame captures. */
  frames: framesSchema.optional(),
  /** DOM-settle facts (fuel for the deterministic selector). */
  settle: settleSchema.optional(),
  /** Viewport at capture — with target.boundingBox, yields the click point. */
  viewport: viewportSchema.optional(),
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

/**
 * A compiled higher-level interaction — the intermediate representation between
 * raw events and guide steps. The Interaction Compiler (worker) groups the
 * normalized event log into interactions; guide synthesis writes one step per
 * interaction. LOSSLESS: an interaction *references* its member events by index
 * (never deletes them), so replay/analytics/AI keep the full history while
 * guide generation sees the collapsed, human-meaningful view.
 */
export type Interaction = {
  /** Indexes into the normalized event log that make up this interaction. */
  eventIndexes: number[];
  /** The member event that best represents it (screenshot/frame + label source). */
  primaryEventIndex: number;
  /**
   * A same-origin navigation folded in as this interaction's consequence (e.g.
   * a click that routed to a new page). The nav event is preserved in
   * `eventIndexes`; this just records that the fold happened.
   */
  absorbedNavigation?: { url: string; pageTitle?: string };
};

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

/** Extension capture flow: create → presign screenshots → submit events. */
export const createExtensionCaptureSchema = z.object({
  title: z.string().trim().max(200).optional(),
  /** Folder the guide should land in (null/absent = default folder). */
  folderId: z.string().min(1).nullish(),
});
export type CreateExtensionCaptureInput = z.infer<
  typeof createExtensionCaptureSchema
>;

export const screenshotUrlsSchema = z.object({
  count: z.number().int().min(0).max(500),
});

export const submitCaptureSchema = z.object({
  events: z
    .array(captureEventSchema)
    .min(1, "A capture needs at least one event")
    .max(2000, "Capture is too large"),
});
export type SubmitCaptureInput = z.infer<typeof submitCaptureSchema>;

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
  sourceIndexes: z
    .array(z.number())
    .describe(
      "Indexes into the numbered INTERACTION list this step was derived from (usually one)"
    ),
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
