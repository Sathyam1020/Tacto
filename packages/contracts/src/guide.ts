import { z } from "zod";

/** Normalized click pointer rect (0–1 of the screenshot). Mirrors the capture
 *  contract's shape; kept local so this module has no cross-file import (the web
 *  bundler can't resolve the `.js` extension in an intra-package import). */
const clickRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

/**
 * Guide editing + publishing contracts.
 *
 * A guide is an ordered list of typed blocks. Only STEP blocks are numbered
 * in display; HEADING/TIP/ALERT are annotations. `content` is HTML (the API
 * sanitizes it on save).
 */

export const blockTypeSchema = z.enum([
  "STEP",
  "HEADING",
  "TIP",
  "ALERT",
  "OUTCOME",
]);
export type BlockType = z.infer<typeof blockTypeSchema>;

/** A block as sent by the editor on save. `id` absent → newly created. */
export const guideBlockInputSchema = z.object({
  id: z.string().optional(),
  type: blockTypeSchema,
  content: z.string().max(20_000),
  /** R2 object key of the block's screenshot (STEP blocks). */
  screenshotKey: z.string().nullish(),
  elementLabel: z.string().nullish(),
  url: z.string().nullish(),
  /** Preserved through edits so the click pointer survives (not edited). */
  clickRect: clickRectSchema.nullish(),
});
export type GuideBlockInput = z.infer<typeof guideBlockInputSchema>;

export const updateGuideSchema = z.object({
  title: z.string().trim().min(1, "Give your guide a title").max(200),
  summary: z.string().max(2000).nullish(),
  blocks: z.array(guideBlockInputSchema).max(500),
});
export type UpdateGuideInput = z.infer<typeof updateGuideSchema>;

/** Move a guide to another workspace (and a folder within it) the caller is a
 *  member of. Every guide belongs to a folder, so a destination folder is
 *  required. */
export const moveGuideSchema = z.object({
  organizationId: z.string().min(1),
  folderId: z.string().min(1),
});

/** Assign a guide to a folder in the same workspace (null = uncategorized). */
export const setGuideFolderSchema = z.object({
  folderId: z.string().min(1).nullable(),
});
export type SetGuideFolderInput = z.infer<typeof setGuideFolderSchema>;
export type MoveGuideInput = z.infer<typeof moveGuideSchema>;

// ── Published-guide customization ────────────────────────────────────────

export const defaultViewSchema = z.enum([
  "scroll-default",
  "walkthrough-default",
  "only-scroll",
  "only-walkthrough",
]);
export const pageLayoutSchema = z.enum([
  "extremely-narrow",
  "narrow",
  "moderate",
  "wide",
  "extremely-wide",
]);
export const hotspotTypeSchema = z.enum([
  "default",
  "glowing-circle",
  "cursor",
  "highlight-box",
]);
export const imageScalingSchema = z.enum(["fit-to-width", "native-size"]);
export const guideFontSchema = z.enum([
  "DM Sans",
  "Inter",
  "Geist",
  "Roboto",
  "Poppins",
  "Montserrat",
  "Lato",
  "Open Sans",
]);
export type GuideFont = z.infer<typeof guideFontSchema>;

export const guideCustomizationSchema = z.object({
  general: z.object({
    defaultView: defaultViewSchema,
    pageLayout: pageLayoutSchema,
    hotspot: z.object({
      type: hotspotTypeSchema,
      /** 0.5–2; 1 = "Default". */
      size: z.number().min(0.25).max(4),
    }),
  }),
  brand: z.object({
    /** Persisted R2 object key of the uploaded logo (round-tripped by the
     *  editor). */
    logoKey: z.string().nullable(),
    /** Display-only presigned URL for the logo. The API injects it on read
     *  and strips it on write — never persisted (presigned URLs expire). */
    logoUrl: z.string().nullable(),
    /** Accent color for the published guide (hex). */
    color: z.string(),
    font: guideFontSchema,
    rtl: z.boolean(),
  }),
  // NOTE: `scrollView` is our **List** view; `walkthroughView` is our
  // **Interactive** view. Internal keys keep the original names to avoid a
  // stored-data migration; all user-facing labels say List / Interactive.
  scrollView: z.object({
    navigationBar: z.boolean(),
    /** 1 | 1.5 | 2 */
    initialZoom: z.number(),
    /** seconds, 0–2 */
    zoomDelay: z.number().min(0).max(5),
    imageScaling: imageScalingSchema,
  }),
  walkthroughView: z.object({
    textAnnotations: z.boolean(),
    showStepCounter: z.boolean(),
    useMarkdown: z.boolean(),
    /** 1 = "No Zoom"; else 1.1–2. */
    zoomLevel: z.number(),
    optimizeForMobile: z.boolean(),
    autoplay: z.object({
      enabled: z.boolean(),
      delaySeconds: z.number().min(0).max(60),
      loop: z.boolean(),
    }),
    cta: z.object({
      enabled: z.boolean(),
      title: z.string(),
      subtitle: z.string(),
      buttonText: z.string(),
      buttonUrl: z.string(),
    }),
    backgroundMusic: z.object({
      url: z.string().nullable(),
      volume: z.number().min(0).max(1),
    }),
  }),
  feedback: z.object({
    allowReactions: z.boolean(),
    allowComments: z.boolean(),
  }),
});
export type GuideCustomization = z.infer<typeof guideCustomizationSchema>;

/** The customization applied when a guide has none (null). */
export const DEFAULT_CUSTOMIZATION: GuideCustomization = {
  general: {
    defaultView: "scroll-default",
    pageLayout: "moderate",
    hotspot: { type: "default", size: 1 },
  },
  brand: {
    logoKey: null,
    logoUrl: null,
    color: "#5e6ad2",
    font: "Geist",
    rtl: false,
  },
  scrollView: {
    navigationBar: true,
    initialZoom: 1,
    zoomDelay: 0.1,
    imageScaling: "fit-to-width",
  },
  walkthroughView: {
    textAnnotations: true,
    showStepCounter: true,
    useMarkdown: true,
    zoomLevel: 1.1,
    optimizeForMobile: false,
    autoplay: { enabled: false, delaySeconds: 3, loop: false },
    cta: { enabled: false, title: "", subtitle: "", buttonText: "", buttonUrl: "" },
    backgroundMusic: { url: null, volume: 0.5 },
  },
  feedback: { allowReactions: false, allowComments: false },
};

/** The fixed set of reactions a viewer can leave on a published guide. */
export const REACTION_EMOJIS = ["👍", "❤️", "🎉", "😮", "🙌"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Public feedback POST bodies (reactions + comments). */
export const reactionInputSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS),
  anonId: z.string().min(1).max(64),
});
export const commentInputSchema = z.object({
  authorName: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(2000),
  anonId: z.string().max(64).nullish(),
});

/** Steps extracted from an uploaded document (DOCX/PDF) by the AI importer. */
export const importedDocSchema = z.object({
  blocks: z
    .array(
      z.object({
        type: z.enum(["STEP", "HEADING"]),
        /** Plain instruction/heading text (no markup). */
        text: z.string(),
      })
    )
    .max(300),
});
export type ImportedDoc = z.infer<typeof importedDocSchema>;

// ── Translations ─────────────────────────────────────────────────────────

/** The languages a guide can be translated into (code + display name). */
export const TRANSLATION_LANGUAGES = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
  { code: "he", name: "Hebrew" },
] as const;
export type TranslationLanguageCode =
  (typeof TRANSLATION_LANGUAGES)[number]["code"];

/** Right-to-left languages — the public reader flips direction for these. */
export const RTL_LANGUAGE_CODES = ["ar", "he", "ur", "fa"] as const;

export const translationLanguageSchema = z.enum(
  TRANSLATION_LANGUAGES.map((l) => l.code) as [string, ...string[]]
);

export const addTranslationSchema = z.object({
  language: translationLanguageSchema,
});

/** AI translation output — mirrors the guide's translatable text. */
export const guideTranslationAiSchema = z.object({
  title: z.string(),
  summary: z.string().nullable(),
  blocks: z.array(z.object({ id: z.string(), content: z.string() })),
});
export type GuideTranslationAi = z.infer<typeof guideTranslationAiSchema>;

/** A stored translation as returned to clients. */
export type GuideTranslationDTO = {
  language: string;
  title: string;
  summary: string | null;
  steps: { blockId: string; content: string }[];
};

/** A block as returned to clients (screenshotUrl is presigned for display). */
export const guideBlockSchema = z.object({
  id: z.string(),
  type: blockTypeSchema,
  position: z.number(),
  content: z.string(),
  screenshotKey: z.string().nullable(),
  screenshotUrl: z.string().nullable(),
  elementLabel: z.string().nullable(),
  url: z.string().nullable(),
  confidence: z.number().nullable(),
});
export type GuideBlock = z.infer<typeof guideBlockSchema>;
