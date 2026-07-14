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

// Voice (Narration → audio) settings ride the guide customization, so a voice
// change stages in the draft and goes live on "Update guide", exactly like
// colors and background music. `provider`/`voiceId` are provider-scoped strings
// validated by the speech-provider registry at synthesis time — kept open so
// the backend (ElevenLabs first) is replaceable without a schema change. Kept
// here (not in voice.ts) so customization has no intra-package import.
export const voiceSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.string(),
  /** Default voice; per-language overrides win when present. */
  defaultVoiceId: z.string().nullable(),
  /** language code → provider voiceId. */
  voiceByLanguage: z.record(z.string(), z.string()).default({}),
  /** Playback/synthesis baseline speed (0.5–2.0). */
  speed: z.number().min(0.5).max(2),
  /** Persona/style hint passed to the provider (null = provider default). */
  style: z.string().nullable(),
  /** Silence inserted between steps during full-guide playback. */
  interStepPauseMs: z.number().min(0).max(10_000),
  format: z.enum(["mp3", "opus"]),
});
export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;

/** Voice settings applied when a guide has none. Disabled by default so
 *  existing guides are unaffected until an author opts in. */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: false,
  provider: "elevenlabs",
  defaultVoiceId: null,
  voiceByLanguage: {},
  speed: 1,
  style: null,
  interStepPauseMs: 500,
  format: "mp3",
};

/** Resolve the voice for a language: the per-language override, else the
 *  default. Returns null when no voice is configured (nothing to synthesize). */
export function voiceForLanguage(
  settings: VoiceSettings,
  language: string
): string | null {
  return settings.voiceByLanguage[language] ?? settings.defaultVoiceId;
}

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
    /** Voiceover (Narration → audio) settings. Defaulted so drafts saved before
     *  this field existed still parse. See the Voice subsystem. */
    voice: voiceSettingsSchema.default(() => DEFAULT_VOICE_SETTINGS),
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
    voice: DEFAULT_VOICE_SETTINGS,
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
      voice: {
        ...d.walkthroughView.voice,
        ...w.voice,
        voiceByLanguage: {
          ...d.walkthroughView.voice.voiceByLanguage,
          ...w.voice?.voiceByLanguage,
        },
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
  /** Per-step callout colors (null = fall back to the brand color / white). */
  calloutBg: z.string().nullable().default(null),
  calloutText: z.string().nullable().default(null),
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

// ── Interactive Presentation (v3) ───────────────────────────────────────────
// The Interactive view is a *presentation* of the one canonical set of Steps,
// not a second copy of them. `Guide.interactive` / the v3 draft store only
// presentation-specific data: Intro/Chapter slides (anchored to a step) and a
// future-proof per-step presentation record. The renderer builds the sequence
// from Steps + presentation via `buildInteractiveSequence` — no duplicated
// content, no synchronization layer.

/** Where a slide sits relative to the Steps. `afterStep` with a stepKey that no
 *  longer exists is an *orphaned* anchor — surfaced, never silently moved. */
export const slideAnchorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("start") }),
  z.object({ kind: z.literal("afterStep"), stepKey: z.string().min(1) }),
]);
export type SlideAnchor = z.infer<typeof slideAnchorSchema>;

/** An Intro/Chapter slide in the presentation (slide fields + an anchor). */
export const presentationSlideSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("intro"), ...slideBase, anchor: slideAnchorSchema }),
  z.object({
    kind: z.literal("chapter"),
    ...slideBase,
    anchor: slideAnchorSchema,
  }),
]);
export type PresentationSlide = z.infer<typeof presentationSlideSchema>;

/** Per-step presentation — intentionally extensible so future Interactive
 *  features (animation, interaction, voiceover) attach here without another
 *  schema redesign. `appearance` holds the per-step callout colors today. */
export const stepPresentationSchema = z.object({
  appearance: z
    .object({
      calloutBackground: z.string().nullable().default(null),
      calloutText: z.string().nullable().default(null),
    })
    .default({ calloutBackground: null, calloutText: null }),
  animation: z.record(z.string(), z.unknown()).default({}),
  interaction: z.record(z.string(), z.unknown()).default({}),
  voice: z.record(z.string(), z.unknown()).default({}),
});
export type StepPresentation = z.infer<typeof stepPresentationSchema>;

export const interactivePresentationSchema = z.object({
  slides: z.array(presentationSlideSchema).max(500).default([]),
  stepPresentation: z.record(z.string(), stepPresentationSchema).default({}),
});
export type InteractivePresentation = z.infer<
  typeof interactivePresentationSchema
>;

/** An empty presentation (no slides, no per-step overrides). */
export const EMPTY_PRESENTATION: InteractivePresentation = {
  slides: [],
  stepPresentation: {},
};

/** A single frame of the Interactive sequence — a shared Step or a slide. */
export type InteractiveSequenceItem<S> =
  | { kind: "step"; step: S }
  | { kind: "slide"; slide: PresentationSlide };

/**
 * Deterministically build the Interactive render sequence from the canonical
 * Steps + the presentation: `start` slides open the walkthrough; `afterStep`
 * slides follow their step (relative order preserved). Slides whose anchor step
 * no longer exists are returned as `orphaned` and NOT placed — the editor
 * surfaces them for re-anchoring (never silently moved). Pure.
 */
export function buildInteractiveSequence<S extends { key: string }>(
  steps: S[],
  presentation: InteractivePresentation
): {
  sequence: InteractiveSequenceItem<S>[];
  orphaned: PresentationSlide[];
} {
  const stepKeys = new Set(steps.map((s) => s.key));
  const afterMap = new Map<string, PresentationSlide[]>();
  const startSlides: PresentationSlide[] = [];
  const orphaned: PresentationSlide[] = [];
  for (const sl of presentation.slides) {
    if (sl.anchor.kind === "start") {
      startSlides.push(sl);
    } else if (stepKeys.has(sl.anchor.stepKey)) {
      const arr = afterMap.get(sl.anchor.stepKey) ?? [];
      arr.push(sl);
      afterMap.set(sl.anchor.stepKey, arr);
    } else {
      orphaned.push(sl);
    }
  }
  const sequence: InteractiveSequenceItem<S>[] = [];
  for (const sl of startSlides) sequence.push({ kind: "slide", slide: sl });
  for (const step of steps) {
    sequence.push({ kind: "step", step });
    for (const sl of afterMap.get(step.key) ?? [])
      sequence.push({ kind: "slide", slide: sl });
  }
  return { sequence, orphaned };
}

/** Convert a v2 interactive tree (duplicated step items + inline slides) into a
 *  v3 presentation: slides get anchored to the preceding step; per-step callout
 *  colors move into `stepPresentation`. Step content/screenshots are dropped
 *  (the Steps are canonical). Deterministic. */
export function migrateInteractiveV2ToPresentation(
  items: WalkthroughItem[]
): InteractivePresentation {
  const slides: PresentationSlide[] = [];
  const stepPresentation: Record<string, StepPresentation> = {};
  let lastStepKey: string | null = null;
  for (const it of items) {
    if (it.kind === "step") {
      lastStepKey = it.key;
      if (it.calloutBg != null || it.calloutText != null) {
        stepPresentation[it.key] = {
          appearance: {
            calloutBackground: it.calloutBg,
            calloutText: it.calloutText,
          },
          animation: {},
          interaction: {},
          voice: {},
        };
      }
    } else {
      slides.push({
        ...it,
        anchor: lastStepKey
          ? { kind: "afterStep", stepKey: lastStepKey }
          : { kind: "start" },
      });
    }
  }
  return { slides, stepPresentation };
}

// ── FAQ ─────────────────────────────────────────────────────────────────────

/** A single guide FAQ. `source` tracks authorship: an AI-suggested FAQ becomes
 *  "user" the moment it's edited, and user FAQs are never auto-replaced by a
 *  regenerate. */
export const faqSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
  source: z.enum(["ai", "user"]),
});
export type Faq = z.infer<typeof faqSchema>;

/** A guide's FAQ list. AI authors at most 5 (enforced at generation); users add
 *  their own on top, so the list itself is capped higher for the draft's sake. */
export const faqsSchema = z.array(faqSchema).max(20);

/** Read a stored `Guide.faqs` JSON value as a validated FAQ list (default []).
 *  Kept identical to the draft's `faqs` default so the dirty-check diff holds. */
export function readFaqs(raw: unknown): Faq[] {
  const parsed = faqsSchema.safeParse(raw ?? []);
  return parsed.success ? parsed.data : [];
}

/** AI structured-output schema for FAQ generation. OpenAI strict mode forbids
 *  optional/default fields, so every field is required; `source` is stamped
 *  server-side (not by the model). */
export const faqAiSchema = z.object({
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
});
export type FaqAiOutput = z.infer<typeof faqAiSchema>;

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

/** v3 — one canonical `blocks` (Steps) + an Interactive *presentation* (slides
 *  + per-step overrides) instead of a duplicated interactive tree. Not wired
 *  into read/publish yet (Phase 3); the schema + transforms exist so that
 *  migration + rendering can be built and tested first. */
export const draftDocumentV3Schema = z.object({
  v: z.literal(3),
  title: z.string().max(200),
  summary: z.string().max(2000).nullable(),
  blocks: z.array(draftBlockSchema).max(500),
  interactive: interactivePresentationSchema,
  assets: z.array(assetSchema).max(1000).default([]),
  customization: guideCustomizationSchema,
  // Defaulted so drafts saved before FAQs existed still parse (mirrors `assets`).
  faqs: faqsSchema.default([]),
});
export type DraftDocumentV3 = z.infer<typeof draftDocumentV3Schema>;

/** Whether a block's HTML has no visible text (used by the v2→v3 nicety). */
function isBlankHtml(html: string): boolean {
  return (
    html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0
  );
}

/** Migrate a v2 draft to v3: convert the interactive tree to a presentation. As
 *  the requested nicety, if a List block is blank but its twin interactive step
 *  had text, the text is copied to the block so nothing is silently lost;
 *  otherwise the List block wins. Deterministic. */
export function migrateDraftV2ToV3(doc: DraftDocumentV2): DraftDocumentV3 {
  const stepItemByKey = new Map(
    doc.interactive.items
      .filter((it): it is WalkthroughStep => it.kind === "step")
      .map((it) => [it.key, it])
  );
  const blocks = doc.blocks.map((b) => {
    const twin = stepItemByKey.get(b.key);
    if (twin && twin.content && isBlankHtml(b.content)) {
      return { ...b, content: twin.content };
    }
    return b;
  });
  return {
    v: 3,
    title: doc.title,
    summary: doc.summary,
    blocks,
    interactive: migrateInteractiveV2ToPresentation(doc.interactive.items),
    assets: doc.assets,
    customization: doc.customization,
    faqs: [],
  };
}

/** Read any stored `Guide.interactive` (a legacy v2 tree `{items}` or a v3
 *  presentation `{slides,…}`) as a presentation. Discriminates by shape since
 *  both schemas are lenient. */
export function readInteractivePresentation(
  raw: unknown
): InteractivePresentation {
  if (raw && typeof raw === "object") {
    if ("slides" in raw || "stepPresentation" in raw) {
      const p = interactivePresentationSchema.safeParse(raw);
      if (p.success) return p.data;
    }
    if ("items" in raw) {
      const t = walkthroughTreeSchema.safeParse(raw);
      if (t.success) return migrateInteractiveV2ToPresentation(t.data.items);
    }
  }
  return EMPTY_PRESENTATION;
}

/** Any stored draft — v1, v2, or v3. Reads go through
 *  {@link migrateDraftDocument} to always work with v3. */
export const draftDocumentSchema = z.discriminatedUnion("v", [
  draftDocumentV1Schema,
  draftDocumentV2Schema,
  draftDocumentV3Schema,
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
      calloutBg: null,
      calloutText: null,
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

/** The asset registry from the canonical Steps alone (v3 — Interactive owns no
 *  images; screenshots live only on the Steps). Deterministic. */
export function collectBlockAssets(blocks: DraftBlock[]): Asset[] {
  const byId = new Map<string, string>();
  for (const b of blocks) {
    if (b.screenshotKey)
      byId.set(b.assetId ?? assetIdForKey(b.key), b.screenshotKey);
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

/** Swap an asset's key everywhere it's referenced — the shared registry plus
 *  every List block and Interactive step that points at it — so editing an image
 *  once updates both modes ("global by construction"). Pure/deterministic. */
export function swapAssetKey(
  doc: DraftDocumentV3,
  assetId: string,
  newKey: string
): DraftDocumentV3 {
  // v3: screenshots live only on the Steps, so an image edit swaps the registry
  // + the matching blocks — no separate Interactive copies to keep in sync.
  return {
    ...doc,
    assets: doc.assets.map((a) =>
      a.id === assetId ? { ...a, key: newKey } : a
    ),
    blocks: doc.blocks.map((b) =>
      b.assetId === assetId ? { ...b, screenshotKey: newKey } : b
    ),
  };
}

/** Migrate any accepted draft document to v2. v1 → seed the Interactive tree
 *  and asset registry from the blocks; v2 → normalize (assets rebuilt so the
 *  registry always matches the trees). Deterministic. */
export function migrateDraftDocument(doc: DraftDocument): DraftDocumentV3 {
  if (doc.v === 3) return doc;
  // v1/v2 → v2, then v2 → v3 (the canonical single-step-set + presentation).
  const blocks = attachAssetIds(doc.blocks);
  const interactive =
    doc.v === 2 ? doc.interactive : seedInteractiveFromBlocks(blocks);
  const v2: DraftDocumentV2 = {
    v: 2,
    title: doc.title,
    summary: doc.summary,
    blocks,
    interactive,
    assets: collectAssets(blocks, interactive),
    customization: doc.customization,
  };
  return migrateDraftV2ToV3(v2);
}

/** Parse a stored (unknown) draft and migrate to v2 in one step. */
export function parseDraftDocument(
  raw: unknown
):
  | { success: true; data: DraftDocumentV3 }
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

/** What to re-translate in an existing language — the title, the summary, or a
 *  single step (by stable key). Powers the editor's granular re-translate. */
export const retranslateTargetSchema = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("title") }),
    z.object({ kind: z.literal("summary") }),
    z.object({ kind: z.literal("step"), stepKey: z.string().min(1) }),
  ]),
});
export type RetranslateTarget = z.infer<
  typeof retranslateTargetSchema
>["target"];

/** AI translation output — mirrors the guide's translatable text. `interactive`
 *  is the flat list of Interactive-tree strings, each returned by the same id.
 *  NOTE: every field must stay REQUIRED (no `.default`/`.optional`) — OpenAI's
 *  strict structured-output rejects a schema whose properties aren't all in
 *  `required`. Callers pass an empty `interactive` array when there's nothing to
 *  translate; the model echoes it back empty. */
export const guideTranslationAiSchema = z.object({
  title: z.string(),
  summary: z.string().nullable(),
  blocks: z.array(z.object({ id: z.string(), content: z.string() })),
  interactive: z.array(z.object({ id: z.string(), content: z.string() })),
});
export type GuideTranslationAi = z.infer<typeof guideTranslationAiSchema>;

/** A translatable string, addressed by a stable id. */
export type InteractiveString = { id: string; content: string };
/** A stored translation — id → translated text. */
export type InteractiveTranslation = Record<string, string>;

/** Overlay a translation onto a presentation's SLIDES (title/subtitle/button
 *  text) by stable key. Step callouts are NOT here — they translate via the
 *  shared List blocks. Pure. */
export function applyPresentationTranslation(
  presentation: InteractivePresentation,
  map: InteractiveTranslation
): InteractivePresentation {
  return {
    ...presentation,
    slides: presentation.slides.map((sl) => ({
      ...sl,
      title: map[`${sl.key}#title`] ?? sl.title,
      subtitle: map[`${sl.key}#subtitle`] ?? sl.subtitle,
      buttons: sl.buttons.map((b) =>
        map[b.key] ? { ...b, text: map[b.key]! } : b
      ),
    })),
  };
}

// ── Translations (key-based, v3) ────────────────────────────────────────────
// Translated block content is keyed by the block's STABLE key (never position),
// so reordering / inserting / deleting steps never misaligns a translation.
// Slide text (title/subtitle/buttons) is keyed the same way. Legacy translations
// were stored as a position-indexed array; `readTranslationSteps` migrates them
// on read against the current block order.

/** Translated block content: stable blockKey → translated HTML/text. */
export const translationStepsSchema = z.record(z.string(), z.string());
export type TranslationSteps = z.infer<typeof translationStepsSchema>;

const legacyTranslationStepsSchema = z.array(
  z.object({ index: z.number().int(), content: z.string() })
);

/** Normalize a stored `steps` value to a key-based map. Accepts the v3 record
 *  form (returned as-is) or the legacy position-indexed array (mapped to keys
 *  via the current block order — the best deterministic migration available).
 *  `orderedKeys` is the current blocks' keys in position order. Pure. */
export function readTranslationSteps(
  raw: unknown,
  orderedKeys: string[]
): TranslationSteps {
  if (Array.isArray(raw)) {
    const legacy = legacyTranslationStepsSchema.safeParse(raw);
    if (!legacy.success) return {};
    const out: TranslationSteps = {};
    for (const s of legacy.data) {
      const key = orderedKeys[s.index];
      if (key) out[key] = s.content;
    }
    return out;
  }
  const rec = translationStepsSchema.safeParse(raw);
  return rec.success ? rec.data : {};
}

/** Collect translatable slide strings from a presentation, keyed exactly as
 *  `applyPresentationTranslation` reads them (`${slideKey}#title` / `#subtitle`,
 *  button key). Step callouts are NOT here — they translate via the shared
 *  blocks. Pure. */
export function collectPresentationStrings(
  presentation: InteractivePresentation
): InteractiveString[] {
  const out: InteractiveString[] = [];
  for (const sl of presentation.slides) {
    if (sl.title) out.push({ id: `${sl.key}#title`, content: sl.title });
    if (sl.subtitle) out.push({ id: `${sl.key}#subtitle`, content: sl.subtitle });
    for (const b of sl.buttons) {
      if (b.text) out.push({ id: b.key, content: b.text });
    }
  }
  return out;
}

/** The source strings a translation was generated from — captured so the editor
 *  can detect which steps drifted and offer a granular re-translate. */
export const translationSourceSchema = z.object({
  title: z.string(),
  summary: z.string().nullable(),
  steps: z.record(z.string(), z.string()),
  slides: z.record(z.string(), z.string()),
});
export type TranslationSource = z.infer<typeof translationSourceSchema>;

/** Parse a stored (unknown) translation source, or null if absent/malformed
 *  (legacy translations predate source capture). */
export function readTranslationSource(raw: unknown): TranslationSource | null {
  if (raw == null) return null;
  const parsed = translationSourceSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type TranslationStaleness = {
  /** Any drift at all — the translation as a whole is out of date. */
  stale: boolean;
  titleStale: boolean;
  summaryStale: boolean;
  /** Keys present in both, but whose source content changed. */
  staleStepKeys: string[];
  /** Keys in the guide with no translation yet (added since). */
  newStepKeys: string[];
  /** Keys the translation still has but the guide dropped. */
  removedStepKeys: string[];
  /** Slide string ids that changed or are missing. */
  staleSlideKeys: string[];
};

const NO_STALENESS: TranslationStaleness = {
  stale: false,
  titleStale: false,
  summaryStale: false,
  staleStepKeys: [],
  newStepKeys: [],
  removedStepKeys: [],
  staleSlideKeys: [],
};

/** Compare a translation's captured source against the guide's current strings.
 *  A null source (legacy translation, pre-capture) yields not-stale with no
 *  granular data — re-generating captures a source going forward. Pure. */
export function computeTranslationStaleness(
  source: TranslationSource | null,
  current: {
    title: string;
    summary: string | null;
    /** blockKey → current content. */
    steps: Record<string, string>;
    /** slide string id → current text. */
    slides: Record<string, string>;
  }
): TranslationStaleness {
  if (!source) return NO_STALENESS;
  const titleStale = source.title !== current.title;
  const summaryStale = (source.summary ?? null) !== (current.summary ?? null);
  const staleStepKeys: string[] = [];
  const newStepKeys: string[] = [];
  for (const [k, content] of Object.entries(current.steps)) {
    if (!(k in source.steps)) newStepKeys.push(k);
    else if (source.steps[k] !== content) staleStepKeys.push(k);
  }
  const removedStepKeys = Object.keys(source.steps).filter(
    (k) => !(k in current.steps)
  );
  const staleSlideKeys: string[] = [];
  for (const [k, text] of Object.entries(current.slides)) {
    if (source.slides[k] !== text) staleSlideKeys.push(k);
  }
  const stale =
    titleStale ||
    summaryStale ||
    staleStepKeys.length > 0 ||
    newStepKeys.length > 0 ||
    removedStepKeys.length > 0 ||
    staleSlideKeys.length > 0;
  return {
    stale,
    titleStale,
    summaryStale,
    staleStepKeys,
    newStepKeys,
    removedStepKeys,
    staleSlideKeys,
  };
}

/** Strict schema for translating a bag of id-keyed strings — the primitive
 *  behind per-step re-translation (every field required for OpenAI strict). */
export const translateStringsAiSchema = z.object({
  strings: z.array(z.object({ id: z.string(), content: z.string() })),
});
export type TranslateStringsAi = z.infer<typeof translateStringsAiSchema>;

/** A stored translation as returned to clients (key-based content). */
export type GuideTranslationDTO = {
  language: string;
  title: string;
  summary: string | null;
  steps: TranslationSteps;
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
