import { narrationSourceFingerprint } from "@workspace/ai";
import {
  buildInteractiveSequence,
  interactivePresentationSchema,
  resolveCustomization,
} from "@workspace/contracts/guide";
import type {
  GuideCustomization,
  PresentationSlide,
} from "@workspace/contracts/guide";
import type { VideoExportStatus, VideoExportView } from "@workspace/contracts/voice";
import { prisma } from "@workspace/db";
import { presignGetDownload } from "@workspace/storage";

/**
 * Video export domain — gathering the guide's composable steps + tracking the
 * export artifact. The heavy ffmpeg composition runs on the worker; this module
 * (shared with the API) prepares inputs and reads/writes status.
 *
 * The export is stored as a single MediaRender per (guide, language) with a
 * fixed renderHash (`export:{language}`) updated in place; a `sourceHash` in
 * `params` records the inputs it was composed from, so staleness is detectable.
 */

export type SlideAppearance = PresentationSlide["appearance"];

/** A screenshot step in the composed sequence. */
export type VideoStep = {
  kind: "step";
  anchorKey: string;
  /** R2 key of the step screenshot. */
  screenshotKey: string;
  clickRect: { x: number; y: number; w: number; h: number } | null;
  /** Narration text (rendered as the caption). */
  text: string;
  /** R2 key of the step's ready narration audio, or null (silent hold). */
  audioKey: string | null;
};

/** An intro/chapter title slide in the composed sequence. */
export type VideoSlide = {
  kind: "slide";
  anchorKey: string;
  slideKind: "intro" | "chapter";
  title: string;
  subtitle: string;
  appearance: SlideAppearance;
  /** R2 key of the slide's ready narration audio, or null (silent hold). */
  audioKey: string | null;
};

export type VideoItem = VideoStep | VideoSlide;

/** Visual style + audio for the composed video, resolved from the guide's
 *  published customization (so the video matches the guide). Brand accent +
 *  hotspot drive the frames; the music track is mixed under the narration. */
export type VideoStyle = {
  brandColor: string;
  hotspotType: string;
  hotspotSize: number;
  /** R2 key of the uploaded background track, or null. */
  musicKey: string | null;
  /** Music level, 0–1 (0 = silent). */
  musicVolume: number;
};

function exportHashKey(language: string): string {
  return `export:${language}`;
}

/** Resolve the guide's brand accent + hotspot for the video overlay. */
export async function gatherVideoStyle(guideId: string): Promise<VideoStyle> {
  const guide = await prisma.guide.findUnique({
    where: { id: guideId },
    select: { customization: true },
  });
  const c = resolveCustomization(
    (guide?.customization as GuideCustomization | null) ?? null
  );
  const music = c.walkthroughView.backgroundMusic;
  return {
    brandColor: c.brand.color,
    hotspotType: c.general.hotspot.type,
    hotspotSize: c.general.hotspot.size,
    musicKey: music.key,
    musicVolume: music.volume,
  };
}

/** The ordered sequence to compose: intro/chapter slides interleaved with the
 *  screenshot steps (matching the Interactive presentation), each with its
 *  linked narration audio for the requested language. */
export async function gatherVideoInputs(
  guideId: string,
  language: string
): Promise<VideoItem[]> {
  const guide = await prisma.guide.findUnique({
    where: { id: guideId },
    select: {
      interactive: true,
      blocks: {
        where: { type: "STEP" },
        orderBy: { position: "asc" },
        select: { key: true, screenshotUrl: true, clickRect: true },
      },
    },
  });
  if (!guide) return [];

  const narration = await prisma.narration.findUnique({
    where: { guideId_language: { guideId, language } },
    select: {
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
  const segByKey = new Map(
    (narration?.segments ?? []).map((s) => [s.anchorKey, s])
  );
  const audioFor = (key: string): string | null => {
    const render = segByKey.get(key)?.renderRefs[0]?.render;
    return render?.status === "ready" ? (render.r2Key ?? null) : null;
  };

  const presentation = interactivePresentationSchema.parse(
    guide.interactive ?? {}
  );
  const { sequence } = buildInteractiveSequence(guide.blocks, presentation);

  const items: VideoItem[] = [];
  for (const entry of sequence) {
    if (entry.kind === "step") {
      const b = entry.step;
      if (!b.screenshotUrl) continue; // no screenshot → nothing to show
      items.push({
        kind: "step",
        anchorKey: b.key,
        screenshotKey: b.screenshotUrl,
        clickRect: (b.clickRect as VideoStep["clickRect"]) ?? null,
        text: segByKey.get(b.key)?.text ?? "",
        audioKey: audioFor(b.key),
      });
    } else {
      const sl = entry.slide;
      items.push({
        kind: "slide",
        anchorKey: sl.key,
        slideKind: sl.kind,
        title: sl.title,
        subtitle: sl.subtitle,
        appearance: sl.appearance,
        audioKey: audioFor(sl.key),
      });
    }
  }
  return items;
}

/** Content fingerprint of the inputs — changes when a screenshot, audio,
 *  caption, click point, order, or brand style changes, so we can tell a ready
 *  video is out of date. All of these are baked into the composed frames. */
export function videoSourceHash(items: VideoItem[], style: VideoStyle): string {
  const stepPart = items
    .map((s) => {
      if (s.kind === "slide") {
        return `slide:${s.slideKind}|${s.audioKey ?? ""}|${s.title}|${s.subtitle}|${JSON.stringify(s.appearance)}`;
      }
      const r = s.clickRect;
      const rect = r ? `${r.x},${r.y},${r.w},${r.h}` : "";
      return `${s.screenshotKey}|${s.audioKey ?? ""}|${rect}|${s.text}`;
    })
    .join("\n");
  const stylePart = `${style.brandColor}|${style.hotspotType}|${style.hotspotSize}|${style.musicKey ?? ""}|${style.musicVolume}`;
  return narrationSourceFingerprint(`${stylePart}\n${stepPart}`);
}

/** Read the export status for a language (presigns the MP4 when ready). */
export async function getVideoExport(
  guideId: string,
  language: string
): Promise<VideoExportView> {
  const row = await prisma.mediaRender.findUnique({
    where: {
      guideId_renderHash: { guideId, renderHash: exportHashKey(language) },
    },
    select: { status: true, r2Key: true, error: true, params: true },
  });
  if (!row) {
    return { language, status: "idle", error: null, url: null, stale: false };
  }
  const status = row.status as VideoExportStatus;
  const url =
    status === "ready" && row.r2Key
      ? await presignGetDownload(row.r2Key, "walkthrough.mp4")
      : null;
  // Stale if the current inputs differ from what the ready video was built from.
  let stale = false;
  if (status === "ready") {
    const [steps, style] = await Promise.all([
      gatherVideoInputs(guideId, language),
      gatherVideoStyle(guideId),
    ]);
    const currentHash = videoSourceHash(steps, style);
    const builtHash = (row.params as { sourceHash?: string } | null)?.sourceHash;
    stale = builtHash !== currentHash;
  }
  return { language, status, error: row.error ?? null, url, stale };
}

/** Mark the export as generating (API, before enqueuing). */
export async function markVideoExportGenerating(
  guideId: string,
  language: string
): Promise<void> {
  await prisma.mediaRender.upsert({
    where: {
      guideId_renderHash: { guideId, renderHash: exportHashKey(language) },
    },
    create: {
      guideId,
      renderHash: exportHashKey(language),
      kind: "export-mp4",
      provider: "ffmpeg",
      voiceId: "",
      format: "mp4",
      language,
      status: "generating",
    },
    update: { status: "generating", error: null },
  });
}

/** Persist a completed export (worker). */
export async function setVideoExportResult(
  guideId: string,
  language: string,
  data: { r2Key: string; sourceHash: string; sizeBytes: number; durationMs: number }
): Promise<void> {
  await prisma.mediaRender.update({
    where: {
      guideId_renderHash: { guideId, renderHash: exportHashKey(language) },
    },
    data: {
      status: "ready",
      r2Key: data.r2Key,
      sizeBytes: data.sizeBytes,
      durationMs: data.durationMs,
      params: { sourceHash: data.sourceHash },
      error: null,
    },
  });
}

/** Mark the export failed (worker). */
export async function setVideoExportFailed(
  guideId: string,
  language: string,
  error: string
): Promise<void> {
  await prisma.mediaRender
    .update({
      where: {
        guideId_renderHash: { guideId, renderHash: exportHashKey(language) },
      },
      data: { status: "failed", error: error.slice(0, 500) },
    })
    .catch(() => {});
}
