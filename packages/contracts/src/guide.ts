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
      /** Persisted R2 key of the uploaded track. Defaulted so drafts saved
       *  before this field existed still parse. */
      key: z.string().nullable().default(null),
      /** Display-only presigned URL — injected on read, stripped on write. */
      url: z.string().nullable().default(null),
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
    backgroundMusic: { key: null, url: null, volume: 0.5 },
  },
  feedback: { allowReactions: false, allowComments: false },
};

/** Merge a stored (possibly null/partial) customization with the defaults into
 *  a complete object. Shared by the API (draft seeding) and the web renderers so
 *  both resolve identically. */
export function resolveCustomization(
  raw: GuideCustomization | null | undefined
): GuideCustomization {
  const d = DEFAULT_CUSTOMIZATION;
  const c = (raw ?? {}) as Partial<GuideCustomization>;
  const w = (c.walkthroughView ?? {}) as Partial<
    GuideCustomization["walkthroughView"]
  >;
  return {
    general: {
      ...d.general,
      ...c.general,
      hotspot: { ...d.general.hotspot, ...c.general?.hotspot },
    },
    brand: { ...d.brand, ...c.brand },
    scrollView: { ...d.scrollView, ...c.scrollView },
    walkthroughView: {
      ...d.walkthroughView,
      ...w,
      autoplay: { ...d.walkthroughView.autoplay, ...w.autoplay },
      cta: { ...d.walkthroughView.cta, ...w.cta },
      backgroundMusic: {
        ...d.walkthroughView.backgroundMusic,
        ...w.backgroundMusic,
      },
    },
    feedback: { ...d.feedback, ...c.feedback },
  };
}

// ── Editor draft (private working document) ──────────────────────────────

/** One block inside a draft document — durable fields only (no presigned
 *  URLs). `key` is the block's stable identity (mirrors Step.key).
 *
 *  `assetId` links the block's screenshot to a shared **Asset** (§ Assets).
 *  Defaulted null so v1 drafts (which predate assets) still parse; migrate-on-
 *  read fills it in. */
export const draftBlockSchema = z.object({
  key: z.string().min(1),
  type: blockTypeSchema,
  content: z.string().max(20_000),
  screenshotKey: z.string().nullable(),
  assetId: z.string().nullable().default(null),
  elementLabel: z.string().nullable(),
  url: z.string().nullable(),
  clickRect: clickRectSchema.nullable(),
  confidence: z.number().nullable(),
});
export type DraftBlock = z.infer<typeof draftBlockSchema>;

// ── Assets (v1) ─────────────────────────────────────────────────────────────
// A first-class, minimal image identity. Both the List block and its twin
// Interactive step reference the *same* asset id, so editing an image once
// (swapping the asset's key) updates both trees — "global by construction".
// `id` is stable across key swaps; `key` is the current R2 object key.

export const assetSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
});
export type Asset = z.infer<typeof assetSchema>;

/** The stable asset id for a block/step, derived from its (stable) key. A List
 *  block and the Interactive step seeded from it share a key, hence one asset. */
export function assetIdForKey(itemKey: string): string {
  return `a_${itemKey}`;
}

// ── Interactive (Walkthrough) tree ──────────────────────────────────────────
// The Interactive mode's independent content tree. Step items mirror a
// screenshot + callout; Intro/Chapter are full slides with jump-to-step
// buttons. Structure/order/text here are independent of the List blocks; only
// screenshot Assets are shared (via assetId).

export const walkthroughButtonSchema = z.object({
  key: z.string().min(1),
  text: z.string().max(200),
  destination: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("next") }),
    z.object({ kind: z.literal("prev") }),
    z.object({ kind: z.literal("step"), stepKey: z.string() }),
  ]),
  bgColor: z.string(),
  textColor: z.string(),
});
export type WalkthroughButton = z.infer<typeof walkthroughButtonSchema>;

const slideAppearanceSchema = z.object({
  background: z
    .object({
      kind: z.enum(["none", "preset", "image"]).default("none"),
      value: z.string().nullable().default(null),
    })
    .default({ kind: "none", value: null }),
  theme: z.enum(["light", "dark"]).default("light"),
  align: z.enum(["left", "center", "right"]).default("center"),
  buttonColumns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
});

export const walkthroughStepSchema = z.object({
  kind: z.literal("step"),
  key: z.string().min(1),
  content: z.string().max(20_000),
  screenshotKey: z.string().nullable().default(null),
  assetId: z.string().nullable().default(null),
  clickRect: clickRectSchema.nullable().default(null),
  confidence: z.number().nullable().default(null),
});

const slideBase = {
  key: z.string().min(1),
  title: z.string().max(500).default(""),
  subtitle: z.string().max(2000).default(""),
  appearance: slideAppearanceSchema.default({
    background: { kind: "none", value: null },
    theme: "light",
    align: "center",
    buttonColumns: 1,
  }),
  buttons: z.array(walkthroughButtonSchema).max(20).default([]),
};

export const walkthroughItemSchema = z.discriminatedUnion("kind", [
  walkthroughStepSchema,
  z.object({ kind: z.literal("intro"), ...slideBase }),
  z.object({ kind: z.literal("chapter"), ...slideBase }),
]);
export type WalkthroughItem = z.infer<typeof walkthroughItemSchema>;
export type WalkthroughStep = z.infer<typeof walkthroughStepSchema>;

export const walkthroughTreeSchema = z.object({
  items: z.array(walkthroughItemSchema).max(500).default([]),
});
export type WalkthroughTree = z.infer<typeof walkthroughTreeSchema>;

// ── Draft document (versioned; migrate-on-read) ─────────────────────────────

/** v1 — the original single-tree document (List blocks only). Still accepted on
 *  read; migrated to v2 in memory. */
export const draftDocumentV1Schema = z.object({
  v: z.literal(1),
  title: z.string().max(200),
  summary: z.string().max(2000).nullable(),
  blocks: z.array(draftBlockSchema).max(500),
  customization: guideCustomizationSchema,
});
export type DraftDocumentV1 = z.infer<typeof draftDocumentV1Schema>;

/** v2 — two independent trees (List `blocks` + `interactive`) plus the shared
 *  `assets` registry. This is what the editor autosaves and publish applies. */
export const draftDocumentV2Schema = z.object({
  v: z.literal(2),
  title: z.string().max(200),
  summary: z.string().max(2000).nullable(),
  blocks: z.array(draftBlockSchema).max(500),
  interactive: walkthroughTreeSchema,
  assets: z.array(assetSchema).max(1000).default([]),
  customization: guideCustomizationSchema,
});
export type DraftDocumentV2 = z.infer<typeof draftDocumentV2Schema>;

/** Any stored draft — v1 or v2. Reads go through {@link migrateDraftDocument}
 *  to always work with v2. */
export const draftDocumentSchema = z.discriminatedUnion("v", [
  draftDocumentV1Schema,
  draftDocumentV2Schema,
]);
export type DraftDocument = z.infer<typeof draftDocumentSchema>;

/** Deterministically seed the Interactive tree from List blocks (1:1 step
 *  items, sharing keys/assets). No randomness/time — safe for migrations. */
export function seedInteractiveFromBlocks(blocks: DraftBlock[]): WalkthroughTree {
  return {
    items: blocks.map((b) => ({
      kind: "step" as const,
      key: b.key,
      content: b.content,
      screenshotKey: b.screenshotKey,
      assetId: b.screenshotKey ? assetIdForKey(b.key) : null,
      clickRect: b.clickRect,
      confidence: b.confidence,
    })),
  };
}

/** Collect the shared asset registry from both trees (dedupe by id; blocks
 *  first for a stable order). Deterministic. */
export function collectAssets(
  blocks: DraftBlock[],
  interactive: WalkthroughTree
): Asset[] {
  const byId = new Map<string, string>();
  for (const b of blocks) {
    if (b.screenshotKey) byId.set(b.assetId ?? assetIdForKey(b.key), b.screenshotKey);
  }
  for (const it of interactive.items) {
    if (it.kind === "step" && it.screenshotKey) {
      byId.set(it.assetId ?? assetIdForKey(it.key), it.screenshotKey);
    }
  }
  return [...byId].map(([id, key]) => ({ id, key }));
}

/** Ensure every block with a screenshot carries its assetId (idempotent). */
function attachAssetIds(blocks: DraftBlock[]): DraftBlock[] {
  return blocks.map((b) => ({
    ...b,
    assetId: b.screenshotKey ? (b.assetId ?? assetIdForKey(b.key)) : null,
  }));
}

/** Migrate any accepted draft document to v2. v1 → seed the Interactive tree
 *  and asset registry from the blocks; v2 → normalize (assets rebuilt so the
 *  registry always matches the trees). Deterministic. */
export function migrateDraftDocument(doc: DraftDocument): DraftDocumentV2 {
  const blocks = attachAssetIds(doc.blocks);
  const interactive =
    doc.v === 2 ? doc.interactive : seedInteractiveFromBlocks(blocks);
  return {
    v: 2,
    title: doc.title,
    summary: doc.summary,
    blocks,
    interactive,
    assets: collectAssets(blocks, interactive),
    customization: doc.customization,
  };
}

/** Parse a stored (unknown) draft and migrate to v2 in one step. */
export function parseDraftDocument(
  raw: unknown
):
  | { success: true; data: DraftDocumentV2 }
  | { success: false; error: z.ZodError } {
  const parsed = draftDocumentSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error };
  return { success: true, data: migrateDraftDocument(parsed.data) };
}

/** Autosave body — the document plus the version the client last saw
 *  (optimistic concurrency). */
export const draftPatchSchema = z.object({
  baseVersion: z.number().int().nonnegative(),
  document: draftDocumentSchema,
});
export type DraftPatch = z.infer<typeof draftPatchSchema>;

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
