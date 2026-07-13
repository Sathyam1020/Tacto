import {
  ELEVENLABS_DEFAULT_VOICE,
  getSpeechProvider,
  renderHash,
} from "@workspace/ai";
import {
  DEFAULT_VOICE_SETTINGS,
  parseDraftDocument,
  resolveCustomization,
  voiceForLanguage,
  type GuideCustomization,
  type VoiceSettings,
} from "@workspace/contracts/guide";
import type {
  AudioStatus,
  NarrationAudioSummary,
} from "@workspace/contracts/voice";
import { prisma } from "@workspace/db";
import { objectExists, presignGet, putObject } from "@workspace/storage";

/**
 * Audio rendering — the disposable, content-addressed artifact layer over
 * narration. A render's identity is the hash of (provider, voice, format, text);
 * identical inputs reuse the same R2 object (no re-synthesis, no re-charge), any
 * change mints a new one. Synthesis runs per segment on the worker (retries +
 * partial failures); the API only prepares + enqueues.
 */

/** A short sample so authors can audition a voice before committing. */
const PREVIEW_TEXT =
  "Hi! This is how I sound. Let's walk through this guide together, step by step.";

/** Presigned URL of a voice's sample clip — synthesized once and cached in R2
 *  (content-addressed by voice id), so repeated previews are instant. */
export async function getVoicePreview(voiceId: string): Promise<string> {
  const key = `voice-previews/${voiceId}.mp3`;
  if (!(await objectExists(key))) {
    const provider = getSpeechProvider("elevenlabs");
    const result = await provider.synthesize({
      text: PREVIEW_TEXT,
      voiceId,
      format: "mp3",
    });
    await putObject(key, result.audio, "audio/mpeg");
  }
  return presignGet(key);
}

async function loadGuideForVoice(guideId: string) {
  return prisma.guide.findUnique({
    where: { id: guideId },
    select: { customization: true, draft: { select: { document: true } } },
  });
}

/** Resolve the guide's voice settings. Prefers the draft (unsaved edits) for
 *  the editor; pass `draftAware: false` for the public reader, which must use
 *  the PUBLISHED customization only. */
export async function resolveVoiceSettings(
  guideId: string,
  draftAware = true
): Promise<VoiceSettings> {
  const guide = await loadGuideForVoice(guideId);
  if (!guide) return DEFAULT_VOICE_SETTINGS;
  let raw = guide.customization as GuideCustomization | null;
  if (draftAware && guide.draft) {
    const parsed = parseDraftDocument(guide.draft.document);
    if (parsed.success) raw = parsed.data.customization;
  }
  return resolveCustomization(raw).walkthroughView.voice;
}

type AudioTarget = { voiceId: string; format: string; hash: string };

/** Content-address a segment's audio from its text + voice config. */
function audioTarget(
  text: string,
  settings: VoiceSettings,
  language: string
): AudioTarget {
  const voiceId =
    voiceForLanguage(settings, language) ?? ELEVENLABS_DEFAULT_VOICE;
  const hash = renderHash({
    kind: "audio",
    provider: settings.provider,
    model: null,
    voiceId,
    format: settings.format,
    payload: text,
  });
  return { voiceId, format: settings.format, hash };
}

function extFor(format: string): string {
  return format === "opus" ? "opus" : "mp3";
}
function contentTypeFor(format: string): string {
  return format === "opus" ? "audio/opus" : "audio/mpeg";
}

async function linkSegmentRender(
  segmentId: string,
  renderId: string
): Promise<void> {
  await prisma.segmentRenderRef.upsert({
    where: { segmentId_kind: { segmentId, kind: "audio" } },
    create: { segmentId, kind: "audio", renderId },
    update: { renderId },
  });
}

/** Per-segment audio state for the editor, keyed by anchor, + a guide summary.
 *  A segment "has audio" only when a render exists for its CURRENT text hash —
 *  so editing narration transparently invalidates its audio. */
export async function loadAudioStatus(
  guideId: string,
  language: string,
  settings: VoiceSettings,
  items: { anchorKey: string; text: string | null }[]
): Promise<{
  byAnchor: Map<string, { status: AudioStatus; url: string | null }>;
  summary: NarrationAudioSummary;
}> {
  const hashByAnchor = new Map<string, string>();
  for (const it of items) {
    if (it.text && it.text.trim()) {
      hashByAnchor.set(it.anchorKey, audioTarget(it.text, settings, language).hash);
    }
  }
  const hashes = [...hashByAnchor.values()];
  const renders = hashes.length
    ? await prisma.mediaRender.findMany({
        where: { guideId, kind: "audio", renderHash: { in: hashes } },
        select: { renderHash: true, status: true, r2Key: true },
      })
    : [];
  const byHash = new Map(renders.map((r) => [r.renderHash, r]));

  // The render each segment currently LINKS to (what was actually generated) —
  // a playable fallback when the current voice/text has no render yet, so audio
  // never silently vanishes after a voice change (regenerate to refresh it).
  const narration = await prisma.narration.findUnique({
    where: { guideId_language: { guideId, language } },
    select: {
      segments: {
        select: {
          anchorKey: true,
          renderRefs: {
            where: { kind: "audio" },
            select: { render: { select: { status: true, r2Key: true } } },
          },
        },
      },
    },
  });
  const linkedByAnchor = new Map(
    (narration?.segments ?? []).map((s) => [s.anchorKey, s.renderRefs[0]?.render])
  );

  const byAnchor = new Map<string, { status: AudioStatus; url: string | null }>();
  let total = 0;
  let ready = 0;
  let upToDate = 0;
  let pending = 0;
  let failed = 0;
  for (const it of items) {
    const hash = hashByAnchor.get(it.anchorKey);
    if (!hash) {
      byAnchor.set(it.anchorKey, { status: "none", url: null });
      continue;
    }
    total++;
    const render = byHash.get(hash);
    if (render?.status === "ready" && render.r2Key) {
      ready++;
      upToDate++; // audio matches the current voice + text
      byAnchor.set(it.anchorKey, {
        status: "ready",
        url: await presignGet(render.r2Key),
      });
    } else if (render?.status === "pending") {
      pending++;
      byAnchor.set(it.anchorKey, { status: "pending", url: null });
    } else if (render?.status === "failed") {
      failed++;
      byAnchor.set(it.anchorKey, { status: "failed", url: null });
    } else {
      // No render for the current voice/text — fall back to the linked render
      // (playable, but out of date → not counted as upToDate).
      const linked = linkedByAnchor.get(it.anchorKey);
      if (linked?.status === "ready" && linked.r2Key) {
        ready++;
        byAnchor.set(it.anchorKey, {
          status: "ready",
          url: await presignGet(linked.r2Key),
        });
      } else {
        byAnchor.set(it.anchorKey, { status: "none", url: null });
      }
    }
  }

  let status: NarrationAudioSummary["status"];
  if (total === 0) status = "idle";
  else if (pending > 0) status = "generating";
  else if (ready === total) status = "ready";
  else if (ready === 0 && failed > 0) status = "failed";
  else status = "partial";

  return {
    byAnchor,
    summary: { total, ready, upToDate, pending, failed, status },
  };
}

/** Mark the segments that still need audio as pending, and return the anchors
 *  the API should enqueue for synthesis (skips segments already rendered). */
export async function prepareAudioBuild(
  guideId: string,
  language: string
): Promise<{ total: number; ready: number; toSynthesize: string[] }> {
  const settings = await resolveVoiceSettings(guideId);
  const narration = await prisma.narration.findUnique({
    where: { guideId_language: { guideId, language } },
    select: { segments: { select: { anchorKey: true, text: true } } },
  });
  const segments = (narration?.segments ?? []).filter(
    (s) => s.text && s.text.trim()
  );

  const toSynthesize: string[] = [];
  let ready = 0;
  for (const seg of segments) {
    const { hash, voiceId, format } = audioTarget(seg.text, settings, language);
    const render = await prisma.mediaRender.findUnique({
      where: { guideId_renderHash: { guideId, renderHash: hash } },
      select: { status: true, r2Key: true },
    });
    if (render?.status === "ready" && render.r2Key) {
      ready++;
      continue;
    }
    await prisma.mediaRender.upsert({
      where: { guideId_renderHash: { guideId, renderHash: hash } },
      create: {
        guideId,
        renderHash: hash,
        kind: "audio",
        provider: settings.provider,
        voiceId,
        format,
        language,
        status: "pending",
      },
      update: { status: "pending", error: null },
    });
    toSynthesize.push(seg.anchorKey);
  }
  return { total: segments.length, ready, toSynthesize };
}

/**
 * Render one segment's audio (worker). Content-addressed: reuses an existing
 * ready render for the exact text+voice (dedup), else synthesizes via the
 * provider, uploads to R2, and persists the MediaRender + link. On failure it
 * marks the render failed and rethrows so BullMQ retries.
 */
export async function synthesizeSegmentAudio(
  guideId: string,
  language: string,
  anchorKey: string
): Promise<void> {
  const settings = await resolveVoiceSettings(guideId);
  const narration = await prisma.narration.findUnique({
    where: { guideId_language: { guideId, language } },
    select: {
      segments: { where: { anchorKey }, select: { id: true, text: true } },
    },
  });
  const segment = narration?.segments[0];
  if (!segment || !segment.text || !segment.text.trim()) return;

  const { hash, voiceId, format } = audioTarget(segment.text, settings, language);

  const existing = await prisma.mediaRender.findUnique({
    where: { guideId_renderHash: { guideId, renderHash: hash } },
    select: { id: true, status: true, r2Key: true },
  });
  if (existing?.status === "ready" && existing.r2Key) {
    await linkSegmentRender(segment.id, existing.id);
    return;
  }

  const render = await prisma.mediaRender.upsert({
    where: { guideId_renderHash: { guideId, renderHash: hash } },
    create: {
      guideId,
      renderHash: hash,
      kind: "audio",
      provider: settings.provider,
      voiceId,
      format,
      language,
      status: "pending",
    },
    update: { status: "pending", error: null },
    select: { id: true },
  });

  try {
    const provider = getSpeechProvider(settings.provider);
    const result = await provider.synthesize({
      text: segment.text,
      voiceId,
      format,
    });
    const r2Key = `voice/${guideId}/${language}/${hash}.${extFor(format)}`;
    await putObject(r2Key, result.audio, contentTypeFor(format));
    await prisma.mediaRender.update({
      where: { id: render.id },
      data: {
        status: "ready",
        r2Key,
        sizeBytes: result.audio.byteLength,
        durationMs: result.durationMs ?? null,
        error: null,
      },
    });
    await linkSegmentRender(segment.id, render.id);
  } catch (err) {
    await prisma.mediaRender
      .update({
        where: { id: render.id },
        data: {
          status: "failed",
          error:
            err instanceof Error ? err.message.slice(0, 500) : "synthesis failed",
        },
      })
      .catch(() => {});
    throw err;
  }
}
