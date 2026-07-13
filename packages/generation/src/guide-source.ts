import {
  buildInteractiveSequence,
  collectPresentationStrings,
  parseDraftDocument,
  readInteractivePresentation,
  TRANSLATION_LANGUAGES,
  type InteractivePresentation,
} from "@workspace/contracts/guide";
import { BASE_LANGUAGE } from "@workspace/contracts/voice";
import { Prisma } from "@workspace/db";

/**
 * Draft-aware guide content resolution — the single source of truth for what
 * translation AND narration are generated from. Prefers the DRAFT (unsaved
 * edits included) over published Step rows; keys are stable across publish, so
 * generated artifacts stay aligned once the guide is Updated.
 */

/** Guide query shape needed to resolve translatable/narratable content. */
export const guideContentSelect = {
  id: true,
  title: true,
  summary: true,
  interactive: true,
  blocks: {
    orderBy: { position: "asc" as const },
    select: { key: true, type: true, content: true },
  },
  draft: { select: { document: true } },
} as const;

export type GuideContentRow = Prisma.GuideGetPayload<{
  select: typeof guideContentSelect;
}>;

type ResolvedContent = {
  title: string;
  summary: string | null;
  blocks: { key: string; type: string; content: string }[];
  presentation: InteractivePresentation;
};

/** Resolve a guide's current content, preferring the draft. */
export function resolveGuideContent(guide: GuideContentRow): ResolvedContent {
  let title = guide.title;
  let summary = guide.summary;
  let blocks = guide.blocks.map((b) => ({
    key: b.key,
    type: b.type as string,
    content: b.content,
  }));
  let interactiveRaw: unknown = guide.interactive;
  if (guide.draft) {
    const parsed = parseDraftDocument(guide.draft.document);
    if (parsed.success) {
      title = parsed.data.title;
      summary = parsed.data.summary;
      blocks = parsed.data.blocks.map((b) => ({
        key: b.key,
        type: b.type,
        content: b.content,
      }));
      interactiveRaw = parsed.data.interactive;
    }
  }
  return {
    title,
    summary,
    blocks,
    presentation: readInteractivePresentation(interactiveRaw),
  };
}

// ── Translation source (block content by key + slide strings by id) ──────────

/** A guide's translatable strings, keyed the way translations store them. */
export function guideTranslatable(guide: GuideContentRow) {
  const { title, summary, blocks, presentation } = resolveGuideContent(guide);
  const steps: Record<string, string> = {};
  for (const b of blocks) steps[b.key] = b.content;
  const slides: Record<string, string> = {};
  for (const s of collectPresentationStrings(presentation)) {
    slides[s.id] = s.content;
  }
  return { title, summary, steps, slides, presentation, blocks };
}

// ── Narration source (spoken-from text per sequence anchor) ──────────────────

export type NarrationAnchor = {
  anchorKey: string;
  kind: "step" | "slide";
  label: string;
  source: string;
};

/** Plain-text view of a block's HTML (what narration is spoken from). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** The interactive sequence's anchors + their on-screen source text. */
export function gatherAnchors(guide: GuideContentRow): {
  title: string;
  summary: string | null;
  anchors: NarrationAnchor[];
} {
  const { title, summary, blocks, presentation } = resolveGuideContent(guide);
  const steps = blocks
    .filter((b) => b.type === "STEP")
    .map((b) => ({ key: b.key, content: b.content }));
  const { sequence } = buildInteractiveSequence(steps, presentation);

  let stepNum = 0;
  const anchors: NarrationAnchor[] = [];
  for (const item of sequence) {
    if (item.kind === "step") {
      stepNum++;
      anchors.push({
        anchorKey: item.step.key,
        kind: "step",
        label: `Step ${stepNum}`,
        source: stripHtml(item.step.content),
      });
    } else {
      const slide = item.slide;
      anchors.push({
        anchorKey: slide.key,
        kind: "slide",
        label: slide.kind === "intro" ? "Intro" : "Chapter",
        source: [slide.title, slide.subtitle].filter(Boolean).join(". "),
      });
    }
  }
  return { title, summary, anchors };
}

/** Human-readable language name for a code (base language → English). */
export function languageName(code: string): string {
  if (code === BASE_LANGUAGE) return "English";
  return TRANSLATION_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
