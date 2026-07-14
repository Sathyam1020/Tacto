import { z } from "zod";

/**
 * Voice subsystem contracts (Narration → Media Render).
 *
 * Narration is the canonical, editable, per-language script keyed by the
 * sequence's stable keys (Step.key / slide.key / intro / outro). Rendered media
 * (audio today; avatar/video later) are disposable, content-addressed artifacts
 * derived from narration + voice settings. This module holds the shared *data*
 * contracts (segment shape, statuses, render kinds, job messages); the provider
 * abstraction + content-addressing live server-side in @workspace/ai.
 */

/** The guide's base (source) language. Narration and translations both treat
 *  English as the implicit source, so base narration is stored under "en". */
export const BASE_LANGUAGE = "en";

/** Reserved narration anchors that are not Steps or slides. */
export const NARRATION_ANCHOR_INTRO = "__intro__";
export const NARRATION_ANCHOR_OUTRO = "__outro__";

/** Lifecycle status shared by narration segments and media renders. */
export const voiceStatusSchema = z.enum(["pending", "ready", "failed"]);
export type VoiceStatus = z.infer<typeof voiceStatusSchema>;

/** Media render kinds. `audio` = per-segment narration; `export-mp4` = a full
 *  composed walkthrough video. The enum is the extension point for avatar video
 *  / podcast without a schema redesign. */
export const mediaRenderKindSchema = z.enum(["audio", "export-mp4"]);
export type MediaRenderKind = z.infer<typeof mediaRenderKindSchema>;

// ── Video export ──────────────────────────────────────────────────────────────

/** Async video-export job — compose a guide's walkthrough into an MP4 on the
 *  worker (ffmpeg is heavy). One queue, one kind for now. */
export const EXPORT_QUEUE = "export-process";

export const exportJobSchema = z.object({
  kind: z.literal("video.export"),
  guideId: z.string(),
  language: z.string(),
});
export type ExportJobData = z.infer<typeof exportJobSchema>;

/** Video export status for the editor/reader to poll. */
export type VideoExportStatus = "idle" | "generating" | "ready" | "failed";

export type VideoExportView = {
  language: string;
  status: VideoExportStatus;
  error: string | null;
  /** Presigned MP4 URL when ready (else null). */
  url: string | null;
  /** Whether the ready video is stale vs. the current guide content. */
  stale: boolean;
};

// ── Voice catalog ─────────────────────────────────────────────────────────────
// A curated set of ElevenLabs voices, each ID validated to synthesize. The key
// on this account can't enumerate voices (voices-read scope), so the catalog is
// static; every id is confirmed working via the TTS endpoint.

/** The default voice when an author hasn't picked one (Rachel — clear US female). */
export const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export type VoiceOption = {
  /** ElevenLabs voice id (provider-scoped). */
  id: string;
  name: string;
  /** Accent/origin group — also the section header in the picker. */
  accent: "Indian" | "American" | "British" | "Australian";
  gender: "female" | "male";
  /** Short vibe, shown under the name. */
  description: string;
};

/** Selectable voices, grouped by accent (Indian first). */
export const VOICE_CATALOG: VoiceOption[] = [
  // Indian
  { id: "2zRM7PkgwBPiau2jvVXc", name: "Monika", accent: "Indian", gender: "female", description: "Warm Hindi/English narrator" },
  { id: "mCQMfsqGDT6IDkEKR20a", name: "Niraj", accent: "Indian", gender: "male", description: "Clear, measured Hindi narrator" },
  { id: "1qEiC6qsybMkmnNdVMbK", name: "Raju", accent: "Indian", gender: "male", description: "Relatable, everyday voice" },
  // American
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", accent: "American", gender: "female", description: "Calm, clear narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", accent: "American", gender: "female", description: "Soft, professional" },
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria", accent: "American", gender: "female", description: "Expressive, friendly" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", accent: "American", gender: "female", description: "Upbeat, youthful" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", accent: "American", gender: "female", description: "Lively, modern" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", accent: "American", gender: "male", description: "Deep, steady" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", accent: "American", gender: "male", description: "Warm narrator" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", accent: "American", gender: "male", description: "Young, energetic" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", accent: "American", gender: "male", description: "Friendly, approachable" },
  // British
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", accent: "British", gender: "female", description: "Warm, gentle" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", accent: "British", gender: "female", description: "Smooth, refined" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", accent: "British", gender: "male", description: "Warm, rich narrator" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", accent: "British", gender: "male", description: "Authoritative, news-style" },
  // Australian
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", accent: "Australian", gender: "male", description: "Casual, natural" },
];

/** Look up a catalog voice by id. */
export function voiceOption(id: string | null): VoiceOption | undefined {
  return id ? VOICE_CATALOG.find((v) => v.id === id) : undefined;
}

/** A narration segment — the spoken script for one anchor. `text` is the source
 *  of truth; audio is a derived render. `sourceFingerprint` detects drift from
 *  the guide (like the translation `source`); `humanEdited` protects manual
 *  edits from being overwritten by regeneration. */
export const narrationSegmentSchema = z.object({
  anchorKey: z.string().min(1),
  text: z.string(),
  /** Provider-neutral structure/overrides (pause, emphasis, style); reserved. */
  markup: z.record(z.string(), z.unknown()).nullable().default(null),
  humanEdited: z.boolean().default(false),
  sourceFingerprint: z.string().nullable().default(null),
  status: voiceStatusSchema.default("ready"),
});
export type NarrationSegment = z.infer<typeof narrationSegmentSchema>;

// Voice *settings* ride the guide customization and therefore live in
// `@workspace/contracts/guide` (`voiceSettingsSchema`, `DEFAULT_VOICE_SETTINGS`,
// `voiceForLanguage`) — guide.ts keeps customization self-contained so the web
// bundler never has to resolve an intra-package import. This module owns the
// voice *domain* (narration, renders, jobs).

// ── Narration generation (AI) ─────────────────────────────────────────────────

/** AI narration output — one spoken segment per anchor, returned by the SAME
 *  anchorKey it was given. NOTE: every field must stay REQUIRED (no
 *  `.default`/`.optional`) — OpenAI's strict structured-output rejects a schema
 *  whose properties aren't all in `required`. */
export const narrationAiSchema = z.object({
  segments: z.array(
    z.object({ anchorKey: z.string(), text: z.string() })
  ),
});
export type NarrationAi = z.infer<typeof narrationAiSchema>;

/** Audio-render state for a segment's CURRENT narration text. `none` = no audio
 *  for this text yet; `ready` = rendered + playable. */
export type AudioStatus = "none" | "pending" | "ready" | "failed";

/** One narration row as returned to the editor: the on-screen `source` it's
 *  spoken from, the generated/edited `text` (null until generated), and drift. */
export type NarrationItemDTO = {
  anchorKey: string;
  kind: "step" | "slide";
  /** Display label — "Step 3" or the slide kind. */
  label: string;
  /** The on-screen text this narration is the spoken version of. */
  source: string;
  /** Generated/edited narration, or null if not yet generated. */
  text: string | null;
  humanEdited: boolean;
  status: VoiceStatus;
  /** The source drifted since this narration was written (needs re-narration). */
  stale: boolean;
  /** Audio-render state for the current text. */
  audioStatus: AudioStatus;
  /** Presigned playback URL when the audio is ready (else null). */
  audioUrl: string | null;
};

/** Guide-level audio-render progress across all narrated segments. */
export type NarrationAudioSummary = {
  total: number;
  /** Segments with playable audio (current render, or an older linked one). */
  ready: number;
  /** Segments whose audio matches the CURRENT voice + text (nothing to redo). */
  upToDate: number;
  pending: number;
  failed: number;
  /** idle (no audio) · generating (some pending) · partial · ready · failed. */
  status: "idle" | "generating" | "partial" | "ready" | "failed";
};

/** Which parts of a narration have drifted from the current guide. Mirrors the
 *  translation staleness model, keyed by anchor. */
export type NarrationStaleness = {
  stale: boolean;
  /** Anchors present in both, but whose source changed. */
  staleAnchors: string[];
  /** Sequence anchors with no narration yet. */
  missingAnchors: string[];
  /** Segments whose anchor is gone from the guide. */
  orphanedAnchors: string[];
};

/** Compare stored segments' `sourceFingerprint` against the current guide's
 *  per-anchor fingerprints (computed server-side via `narrationSourceFingerprint`).
 *  Pure. */
export function computeNarrationStaleness(
  segments: { anchorKey: string; sourceFingerprint: string | null }[],
  currentFingerprints: Record<string, string>
): NarrationStaleness {
  const byAnchor = new Map(segments.map((s) => [s.anchorKey, s]));
  const staleAnchors: string[] = [];
  const missingAnchors: string[] = [];
  for (const [anchor, fp] of Object.entries(currentFingerprints)) {
    const seg = byAnchor.get(anchor);
    if (!seg) missingAnchors.push(anchor);
    // A drifted source (or an un-fingerprinted segment) needs re-narration.
    else if (seg.sourceFingerprint !== fp) staleAnchors.push(anchor);
  }
  const orphanedAnchors = segments
    .map((s) => s.anchorKey)
    .filter((a) => !(a in currentFingerprints));
  const stale =
    staleAnchors.length > 0 ||
    missingAnchors.length > 0 ||
    orphanedAnchors.length > 0;
  return { stale, staleAnchors, missingAnchors, orphanedAnchors };
}

// ── Background job contract ───────────────────────────────────────────────────
// The shared contract between the API (producer) and the worker (consumer),
// mirroring CAPTURE_QUEUE / CaptureJobData: `translation.generate`,
// `narration.generate`, and per-segment `voice.synthesize`.

/** Translation generation queue — whole-guide translation runs async on the
 *  worker so the editor never blocks for minutes. Per-field re-translation stays
 *  synchronous in the API (it's fast). */
export const TRANSLATION_QUEUE = "translation-process";

export const translationJobSchema = z.object({
  kind: z.literal("translation.generate"),
  guideId: z.string(),
  language: z.string(),
});
export type TranslationJobData = z.infer<typeof translationJobSchema>;

export const VOICE_QUEUE = "voice-process";

export const voiceJobSchema = z.discriminatedUnion("kind", [
  /** Generate/refresh narration text for a (guide, language). */
  z.object({
    kind: z.literal("narration.generate"),
    guideId: z.string(),
    language: z.string(),
    /** Limit to one anchor (single-step regeneration); omit for the guide. */
    anchorKey: z.string().optional(),
    /** Overwrite human-edited segments too (explicit force). */
    force: z.boolean().optional(),
  }),
  /** Render one narration segment to audio (content-addressed). */
  z.object({
    kind: z.literal("voice.synthesize"),
    guideId: z.string(),
    language: z.string(),
    anchorKey: z.string(),
  }),
]);
export type VoiceJobData = z.infer<typeof voiceJobSchema>;
