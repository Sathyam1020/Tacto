import { createHash } from "node:crypto";

/**
 * Speech (text-to-speech) provider abstraction + render content-addressing.
 *
 * Narration is provider-agnostic; only the *render* is provider-specific. A
 * render's identity is the hash of everything that determines its audio, so
 * identical inputs reuse the same artifact (no re-synthesis) and any change
 * mints a new one (leaving the old valid for anything still referencing it).
 * The ElevenLabs adapter registers here in Phase 3; the interface keeps the
 * backend replaceable.
 */

/** A provider-neutral request to synthesize one narration payload into audio. */
export type SpeechSynthesisRequest = {
  /** The exact text/markup to speak (already localized). */
  text: string;
  /** Provider-scoped voice identifier. */
  voiceId: string;
  /** Provider model id (optional; provider default when omitted). */
  model?: string | null;
  /** Output container/codec, e.g. "mp3". */
  format: string;
  /** Baseline speed (1 = normal). */
  speed?: number | null;
  /** Persona/style hint (null = provider default). */
  style?: string | null;
};

/** The audio bytes + metadata a provider returns. */
export type SpeechSynthesisResult = {
  audio: Uint8Array;
  format: string;
  /** Duration in ms when the provider reports it (drives playback sync). */
  durationMs?: number;
};

/** A replaceable TTS backend. */
export interface SpeechProvider {
  /** Stable registry name (matches `VoiceSettings.provider`). */
  readonly name: string;
  synthesize(req: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>;
}

const providers = new Map<string, SpeechProvider>();

/** Register a speech provider adapter (called once at worker startup). */
export function registerSpeechProvider(provider: SpeechProvider): void {
  providers.set(provider.name, provider);
}

/** Whether a provider name is registered. */
export function hasSpeechProvider(name: string): boolean {
  return providers.has(name);
}

/** Resolve a registered provider by name, or throw a clear config error. */
export function getSpeechProvider(name: string): SpeechProvider {
  const provider = providers.get(name);
  if (!provider) {
    const known = [...providers.keys()].join(", ") || "(none)";
    throw new Error(
      `No speech provider registered for "${name}". Registered: ${known}`
    );
  }
  return provider;
}

/** Inputs that fully determine a render's audio — its content address. */
export type RenderIdentity = {
  /** Media kind ("audio"; future: avatar-video, export-mp4, podcast). */
  kind: string;
  provider: string;
  model?: string | null;
  voiceId: string;
  format: string;
  speed?: number | null;
  style?: string | null;
  /** The exact narration payload sent to the provider. */
  payload: string;
};

/**
 * Deterministic content-address for a render. Same inputs → same hash → same
 * stored artifact (no re-synthesis); any change → new hash → a new render, with
 * the old one still valid for anything already referencing it. This single
 * function is the caching, dedup, and cache-invalidation strategy.
 */
export function renderHash(id: RenderIdentity): string {
  // A fixed-order tuple so the hash is stable across field-ordering changes.
  const canonical = JSON.stringify([
    id.kind,
    id.provider,
    id.model ?? "",
    id.voiceId,
    id.format,
    id.speed ?? 1,
    id.style ?? "",
    id.payload,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

/** Fingerprint the upstream source a narration segment was written from, so
 *  drift (step/slide text changed) is detectable — the narration analogue of
 *  the translation `source` capture. */
export function narrationSourceFingerprint(sourceText: string): string {
  return createHash("sha256").update(sourceText).digest("hex");
}
