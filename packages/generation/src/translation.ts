import { translateGuide, translateStrings } from "@workspace/ai";
import {
  collectPresentationStrings,
  computeTranslationStaleness,
  readTranslationSource,
  readTranslationSteps,
  TRANSLATION_LANGUAGES,
  type RetranslateTarget,
  type TranslationSource,
  type TranslationStaleness,
  type TranslationSteps,
} from "@workspace/contracts/guide";
import { prisma } from "@workspace/db";

import { guideContentSelect, guideTranslatable } from "./guide-source.js";
import { sanitizeContent } from "./sanitize.js";

/**
 * Translation service — AI language versions of a guide's text, keyed by stable
 * Step.key. Whole-guide generation runs on the worker (async, status-tracked);
 * granular per-field re-translation runs in the API (fast). Draft-aware.
 */

export type TranslationJobStatus = "generating" | "ready" | "failed";

export type TranslationDTO = {
  language: string;
  title: string;
  summary: string | null;
  steps: TranslationSteps;
  published: boolean;
  status: TranslationJobStatus;
  error: string | null;
  staleness: TranslationStaleness;
};

async function loadGuide(guideId: string) {
  return prisma.guide.findUnique({
    where: { id: guideId },
    select: guideContentSelect,
  });
}

function languageName(code: string): string {
  return TRANSLATION_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

/** All translations for a guide, with key-based steps + staleness + status. */
export async function getTranslations(
  guideId: string
): Promise<TranslationDTO[]> {
  const guide = await loadGuide(guideId);
  if (!guide) return [];
  const current = guideTranslatable(guide);
  const orderedKeys = current.blocks.map((b) => b.key);

  const rows = await prisma.guideTranslation.findMany({
    where: { guideId },
    orderBy: { language: "asc" },
    select: {
      language: true,
      title: true,
      summary: true,
      steps: true,
      source: true,
      published: true,
      status: true,
      error: true,
    },
  });
  return rows.map((t) => ({
    language: t.language,
    title: t.title,
    summary: t.summary,
    steps: readTranslationSteps(t.steps, orderedKeys),
    published: t.published,
    status: (t.status as TranslationJobStatus) ?? "ready",
    error: t.error ?? null,
    staleness: computeTranslationStaleness(readTranslationSource(t.source), current),
  }));
}

/** Mark a language as generating (API, before enqueuing). Creates a placeholder
 *  row so the editor immediately shows it as in-progress; keeps prior content
 *  (if any) visible until the worker overwrites it. */
export async function markTranslationGenerating(
  guideId: string,
  language: string
): Promise<void> {
  await prisma.guideTranslation.upsert({
    where: { guideId_language: { guideId, language } },
    create: {
      guideId,
      language,
      title: "",
      summary: null,
      steps: {},
      interactive: {},
      status: "generating",
      published: false,
    },
    update: { status: "generating", error: null },
  });
}

export async function setTranslationStatus(
  guideId: string,
  language: string,
  status: TranslationJobStatus,
  error: string | null = null
): Promise<void> {
  await prisma.guideTranslation
    .update({
      where: { guideId_language: { guideId, language } },
      data: { status, error },
    })
    .catch(() => {
      /* row may have been deleted mid-flight — ignore */
    });
}

/**
 * Generate a full translation for a language (worker). Blocks translated by
 * stable key; slide strings by id; source captured for drift detection. Sets
 * status = ready on success.
 */
export async function generateTranslation(
  guideId: string,
  language: string
): Promise<void> {
  const guide = await loadGuide(guideId);
  if (!guide) return;
  const current = guideTranslatable(guide);

  const ai = await translateGuide(
    {
      title: current.title,
      summary: current.summary,
      blocks: current.blocks.map((b) => ({ id: b.key, content: b.content })),
      interactive: collectPresentationStrings(current.presentation),
    },
    languageName(language)
  );

  const steps: Record<string, string> = {};
  for (const b of ai.blocks) {
    if (b.id in current.steps) steps[b.id] = sanitizeContent(b.content);
  }
  const interactive: Record<string, string> = {};
  for (const s of ai.interactive) {
    interactive[s.id] = /[<>]/.test(s.content)
      ? sanitizeContent(s.content)
      : s.content;
  }
  const source: TranslationSource = {
    title: current.title,
    summary: current.summary,
    steps: current.steps,
    slides: current.slides,
  };

  await prisma.guideTranslation.upsert({
    where: { guideId_language: { guideId, language } },
    create: {
      guideId,
      language,
      title: ai.title,
      summary: ai.summary,
      steps,
      interactive,
      source,
      status: "ready",
      error: null,
      published: false,
    },
    update: {
      title: ai.title,
      summary: ai.summary,
      steps,
      interactive,
      source,
      status: "ready",
      error: null,
      published: false,
    },
  });
}

/** Re-translate one part of an existing translation (title/summary/step) from
 *  the current guide text. Fast — runs synchronously in the API. */
export async function retranslateTarget(
  guideId: string,
  language: string,
  target: RetranslateTarget
): Promise<void> {
  const guide = await loadGuide(guideId);
  if (!guide) throw new TranslationNotFound(language);
  const existing = await prisma.guideTranslation.findUnique({
    where: { guideId_language: { guideId, language } },
    select: { steps: true, source: true },
  });
  if (!existing) throw new TranslationNotFound(language);
  const current = guideTranslatable(guide);

  const source: TranslationSource = readTranslationSource(existing.source) ?? {
    title: current.title,
    summary: current.summary,
    steps: { ...current.steps },
    slides: { ...current.slides },
  };
  const data: {
    title?: string;
    summary?: string | null;
    steps?: Record<string, string>;
    source: TranslationSource;
    published: false;
  } = { source, published: false };

  if (target.kind === "title") {
    const [out] = await translateStrings(
      [{ id: "title", content: current.title }],
      languageName(language)
    );
    data.title = out ? out.content : current.title;
    source.title = current.title;
  } else if (target.kind === "summary") {
    if (current.summary == null) {
      data.summary = null;
    } else {
      const [out] = await translateStrings(
        [{ id: "summary", content: current.summary }],
        languageName(language)
      );
      data.summary = out ? out.content : current.summary;
    }
    source.summary = current.summary;
  } else {
    const block = current.blocks.find((b) => b.key === target.stepKey);
    if (!block) throw new TranslationNotFound(language);
    const [out] = await translateStrings(
      [{ id: target.stepKey, content: block.content }],
      languageName(language)
    );
    const translated = out ? sanitizeContent(out.content) : block.content;
    const steps = readTranslationSteps(
      existing.steps,
      current.blocks.map((b) => b.key)
    );
    steps[target.stepKey] = translated;
    data.steps = steps;
    source.steps[target.stepKey] = block.content;
  }

  await prisma.guideTranslation.update({
    where: { guideId_language: { guideId, language } },
    data,
  });
}

/** Remove a translation. */
export async function deleteTranslation(
  guideId: string,
  language: string
): Promise<void> {
  await prisma.guideTranslation.deleteMany({ where: { guideId, language } });
}

export class TranslationNotFound extends Error {
  constructor(language: string) {
    super(`No translation for "${language}"`);
    this.name = "TranslationNotFound";
  }
}
