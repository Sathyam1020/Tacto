import {
  generateNarration as aiGenerateNarration,
  narrationSourceFingerprint,
} from "@workspace/ai";
import { readTranslationSteps } from "@workspace/contracts/guide";
import {
  BASE_LANGUAGE,
  computeNarrationStaleness,
  type NarrationAudioSummary,
  type NarrationItemDTO,
  type NarrationStaleness,
  type VoiceStatus,
} from "@workspace/contracts/voice";
import { prisma } from "@workspace/db";
import { presignGet } from "@workspace/storage";

import { loadAudioStatus, resolveVoiceSettings } from "./audio.js";
import {
  gatherAnchors,
  guideContentSelect,
  languageName,
  stripHtml,
} from "./guide-source.js";
import type { GuideContentRow, NarrationAnchor } from "./guide-source.js";

/** Anchors + title/summary localized to `language`: for non-base languages the
 *  narration is generated from the guide's TRANSLATION (better fidelity than
 *  narrating in-language from the base text). Falls back to base source when no
 *  translation exists — the model still narrates in the target language. */
async function localizedAnchors(guide: GuideContentRow, language: string) {
  const base = gatherAnchors(guide);
  if (language === BASE_LANGUAGE) return base;
  const translation = await prisma.guideTranslation.findUnique({
    where: { guideId_language: { guideId: guide.id, language } },
    select: { title: true, summary: true, steps: true, interactive: true },
  });
  if (!translation) return base;

  const stepKeys = base.anchors
    .filter((a) => a.kind === "step")
    .map((a) => a.anchorKey);
  const steps = readTranslationSteps(translation.steps, stepKeys);
  const slides = (translation.interactive ?? {}) as Record<string, string>;
  const anchors: NarrationAnchor[] = base.anchors.map((a) => {
    if (a.kind === "step") {
      const t = steps[a.anchorKey];
      return t ? { ...a, source: stripHtml(t) } : a;
    }
    const title = slides[`${a.anchorKey}#title`];
    const subtitle = slides[`${a.anchorKey}#subtitle`];
    const src = [title, subtitle].filter(Boolean).join(". ");
    return src ? { ...a, source: src } : a;
  });
  return {
    title: translation.title || base.title,
    summary: translation.summary ?? base.summary,
    anchors,
  };
}

/**
 * Narration service — the canonical spoken script per language, keyed by the
 * interactive sequence's stable anchors. Generation (AI) runs on the worker;
 * reads/edits run in the API. Narration is the source of truth; audio (renders)
 * derive from it.
 */

/** Narration-level generation status (mirrors capture status semantics). */
export type NarrationJobStatus = "idle" | "generating" | "ready" | "failed";

export type NarrationView = {
  language: string;
  status: NarrationJobStatus;
  error: string | null;
  generated: boolean;
  items: NarrationItemDTO[];
  staleness: NarrationStaleness;
  audio: NarrationAudioSummary;
};

async function loadGuide(guideId: string) {
  return prisma.guide.findUnique({
    where: { id: guideId },
    select: guideContentSelect,
  });
}

function emptyView(language: string): NarrationView {
  return {
    language,
    status: "idle",
    error: null,
    generated: false,
    items: [],
    staleness: {
      stale: false,
      staleAnchors: [],
      missingAnchors: [],
      orphanedAnchors: [],
    },
    audio: {
      total: 0,
      ready: 0,
      upToDate: 0,
      pending: 0,
      failed: 0,
      status: "idle",
    },
  };
}

/** Read the narration for a language — the ordered, staleness-annotated list. */
export async function getNarration(
  guideId: string,
  language: string
): Promise<NarrationView> {
  const guide = await loadGuide(guideId);
  if (!guide) return emptyView(language);
  const { anchors } = await localizedAnchors(guide, language);

  const narration = await prisma.narration.findUnique({
    where: { guideId_language: { guideId, language } },
    select: {
      status: true,
      error: true,
      segments: {
        select: {
          anchorKey: true,
          text: true,
          humanEdited: true,
          status: true,
          sourceFingerprint: true,
        },
      },
    },
  });
  const segments = narration?.segments ?? [];
  const byAnchor = new Map(segments.map((s) => [s.anchorKey, s]));

  const currentFingerprints: Record<string, string> = {};
  for (const a of anchors) {
    currentFingerprints[a.anchorKey] = narrationSourceFingerprint(a.source);
  }
  const staleness = computeNarrationStaleness(
    segments.map((s) => ({
      anchorKey: s.anchorKey,
      sourceFingerprint: s.sourceFingerprint,
    })),
    currentFingerprints
  );
  const staleSet = new Set(staleness.staleAnchors);

  const items: NarrationItemDTO[] = anchors.map((a) => {
    const seg = byAnchor.get(a.anchorKey);
    return {
      anchorKey: a.anchorKey,
      kind: a.kind,
      label: a.label,
      source: a.source,
      text: seg?.text ?? null,
      humanEdited: seg?.humanEdited ?? false,
      status: (seg?.status as VoiceStatus) ?? "pending",
      stale: staleSet.has(a.anchorKey),
      audioStatus: "none",
      audioUrl: null,
    };
  });

  // Overlay per-segment audio state (content-addressed to the current text).
  const settings = await resolveVoiceSettings(guideId);
  const audio = await loadAudioStatus(
    guideId,
    language,
    settings,
    items.map((i) => ({ anchorKey: i.anchorKey, text: i.text }))
  );
  for (const item of items) {
    const a = audio.byAnchor.get(item.anchorKey);
    item.audioStatus = a?.status ?? "none";
    item.audioUrl = a?.url ?? null;
  }

  return {
    language,
    status: (narration?.status as NarrationJobStatus) ?? "idle",
    error: narration?.error ?? null,
    generated: segments.length > 0,
    items,
    staleness,
    audio: audio.summary,
  };
}

/** Voiceover audio + text per anchor, for playback in the walkthrough. */
export type NarrationPlayback = Record<
  string,
  { text: string; audioUrl: string }
>;

/** Build the playback map for a language: each anchor with ready audio for its
 *  CURRENT text → a presigned URL. `published` restricts to published narration
 *  + published (non-draft) voice settings (the public reader). */
export async function getNarrationPlayback(
  guideId: string,
  language: string,
  opts: { published: boolean }
): Promise<NarrationPlayback> {
  // Resolve audio via the segment's render LINK (what was actually rendered +
  // published), not a hash recomputed from current settings — so playback is
  // robust to any later voice/text drift ("publish freezes the render refs").
  const narration = await prisma.narration.findUnique({
    where: { guideId_language: { guideId, language } },
    select: {
      published: true,
      segments: {
        select: {
          anchorKey: true,
          text: true,
          renderRefs: {
            where: { kind: "audio" },
            select: { render: { select: { status: true, r2Key: true } } },
          },
        },
      },
    },
  });
  if (!narration) return {};
  if (opts.published && !narration.published) return {};

  const map: NarrationPlayback = {};
  for (const s of narration.segments) {
    const render = s.renderRefs[0]?.render;
    if (render?.status === "ready" && render.r2Key && s.text && s.text.trim()) {
      map[s.anchorKey] = { text: s.text, audioUrl: await presignGet(render.r2Key) };
    }
  }
  return map;
}

/** Every published language's playback map (base + translations that have
 *  rendered audio), for the public reader's language switcher. */
export async function getPublishedNarrationByLanguage(
  guideId: string
): Promise<Record<string, NarrationPlayback>> {
  const narrations = await prisma.narration.findMany({
    where: { guideId, published: true },
    select: { language: true },
  });
  const out: Record<string, NarrationPlayback> = {};
  for (const n of narrations) {
    const map = await getNarrationPlayback(guideId, n.language, {
      published: true,
    });
    if (Object.keys(map).length > 0) out[n.language] = map;
  }
  return out;
}

/** Mark a narration as generating (called by the API before enqueuing), so the
 *  editor can poll a live status. Creates the row if absent. */
export async function markNarrationGenerating(
  guideId: string,
  language: string
): Promise<void> {
  await prisma.narration.upsert({
    where: { guideId_language: { guideId, language } },
    create: { guideId, language, published: false, status: "generating" },
    update: { status: "generating", error: null },
  });
}

/** Set the terminal status of a narration (worker, on success/failure). */
export async function setNarrationStatus(
  guideId: string,
  language: string,
  status: NarrationJobStatus,
  error: string | null = null
): Promise<void> {
  await prisma.narration
    .update({
      where: { guideId_language: { guideId, language } },
      data: { status, error },
    })
    .catch(() => {
      /* narration row may have been deleted mid-flight — ignore */
    });
}

/**
 * Generate narration for a guide (whole guide, or a single anchor). Runs the
 * batched LLM call and persists segments. Human-edited segments are preserved on
 * a whole-guide run unless `force`; a single-anchor regenerate always replaces.
 * Orphaned segments are pruned on whole-guide runs. Sets the narration status.
 */
export async function generateNarrationForGuide(
  guideId: string,
  language: string,
  opts: { anchorKey?: string; force?: boolean; style?: string | null } = {}
): Promise<void> {
  const guide = await loadGuide(guideId);
  if (!guide) return;
  const { title, summary, anchors } = await localizedAnchors(guide, language);
  const anchorByKey = new Map(anchors.map((a) => [a.anchorKey, a]));

  const existing = await prisma.narration.findUnique({
    where: { guideId_language: { guideId, language } },
    select: { segments: { select: { anchorKey: true, humanEdited: true } } },
  });
  const humanEdited = new Set(
    (existing?.segments ?? [])
      .filter((s) => s.humanEdited)
      .map((s) => s.anchorKey)
  );

  let targets: NarrationAnchor[];
  if (opts.anchorKey) {
    const a = anchorByKey.get(opts.anchorKey);
    if (!a) throw new NarrationAnchorNotFound(opts.anchorKey);
    targets = [a];
  } else {
    targets = opts.force
      ? anchors
      : anchors.filter((a) => !humanEdited.has(a.anchorKey));
  }

  const generated = await aiGenerateNarration(
    {
      title,
      summary,
      segments: targets.map((a) => ({
        anchorKey: a.anchorKey,
        source: a.source,
      })),
    },
    { languageName: languageName(language), style: opts.style ?? null }
  );
  const textByAnchor = new Map(generated.map((g) => [g.anchorKey, g.text]));

  await prisma.$transaction(
    async (tx) => {
      const narration = await tx.narration.upsert({
        where: { guideId_language: { guideId, language } },
        create: { guideId, language, published: false, status: "ready" },
        update: {},
        select: { id: true },
      });
      for (const a of targets) {
        const text = textByAnchor.get(a.anchorKey);
        if (text == null) continue; // model omitted it — leave as-is
        const fingerprint = narrationSourceFingerprint(a.source);
        await tx.narrationSegment.upsert({
          where: {
            narrationId_anchorKey: {
              narrationId: narration.id,
              anchorKey: a.anchorKey,
            },
          },
          create: {
            narrationId: narration.id,
            anchorKey: a.anchorKey,
            text,
            sourceFingerprint: fingerprint,
            humanEdited: false,
            status: "ready",
          },
          update: {
            text,
            sourceFingerprint: fingerprint,
            humanEdited: false,
            status: "ready",
          },
        });
      }
      if (!opts.anchorKey && anchors.length > 0) {
        await tx.narrationSegment.deleteMany({
          where: {
            narrationId: narration.id,
            anchorKey: { notIn: anchors.map((a) => a.anchorKey) },
          },
        });
      }
    },
    { timeout: 30_000, maxWait: 10_000 }
  );
}

/** Overwrite one segment's narration with a human edit (protected from
 *  regeneration, fingerprinted fresh against the current source). */
export async function editNarrationSegment(
  guideId: string,
  language: string,
  anchorKey: string,
  text: string
): Promise<NarrationView> {
  const guide = await loadGuide(guideId);
  if (!guide) return emptyView(language);
  const { anchors } = await localizedAnchors(guide, language);
  const anchor = anchors.find((a) => a.anchorKey === anchorKey);
  if (!anchor) throw new NarrationAnchorNotFound(anchorKey);
  const fingerprint = narrationSourceFingerprint(anchor.source);

  const narration = await prisma.narration.upsert({
    where: { guideId_language: { guideId, language } },
    create: { guideId, language, published: false, status: "ready" },
    update: {},
    select: { id: true },
  });
  await prisma.narrationSegment.upsert({
    where: { narrationId_anchorKey: { narrationId: narration.id, anchorKey } },
    create: {
      narrationId: narration.id,
      anchorKey,
      text,
      sourceFingerprint: fingerprint,
      humanEdited: true,
      status: "ready",
    },
    update: {
      text,
      sourceFingerprint: fingerprint,
      humanEdited: true,
      status: "ready",
    },
  });
  return getNarration(guideId, language);
}

/** Remove all narration for a language. */
export async function deleteNarration(
  guideId: string,
  language: string
): Promise<void> {
  await prisma.narration.deleteMany({ where: { guideId, language } });
}

/** Thrown when a narration operation targets an anchor not in the guide. */
export class NarrationAnchorNotFound extends Error {
  constructor(anchorKey: string) {
    super(`No sequence anchor "${anchorKey}" in this guide`);
    this.name = "NarrationAnchorNotFound";
  }
}
