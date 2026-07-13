import { DEFAULT_VOICE_ID } from "@workspace/contracts/voice";

import type {
  SpeechProvider,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
} from "../speech.js";

/**
 * ElevenLabs text-to-speech adapter. Thin `fetch` against the public TTS API —
 * no SDK dependency, so swapping providers later is a new adapter, not a
 * refactor. Registered at worker startup when ELEVENLABS_API_KEY is present.
 */

/** Multilingual model — one narration script, many languages. */
export const ELEVENLABS_MODEL = "eleven_multilingual_v2";

/** A sensible default voice ("Rachel") so audio works before an author picks
 *  one. Overridden by VoiceSettings.defaultVoiceId / per-language voice. */
export const ELEVENLABS_DEFAULT_VOICE = DEFAULT_VOICE_ID;

const FORMAT_TO_ELEVEN = new Map<string, string>([
  ["mp3", "mp3_44100_128"],
  ["opus", "opus_48000_128"],
]);

export function createElevenLabsProvider(apiKey: string): SpeechProvider {
  return {
    name: "elevenlabs",
    async synthesize(
      req: SpeechSynthesisRequest
    ): Promise<SpeechSynthesisResult> {
      const outputFormat = FORMAT_TO_ELEVEN.get(req.format) ?? "mp3_44100_128";
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${req.voiceId}?output_format=${outputFormat}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "content-type": "application/json",
            accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: req.text,
            model_id: req.model ?? ELEVENLABS_MODEL,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `ElevenLabs ${res.status} ${res.statusText}: ${detail.slice(0, 300)}`
        );
      }
      const audio = new Uint8Array(await res.arrayBuffer());
      if (audio.byteLength === 0) {
        throw new Error("ElevenLabs returned empty audio");
      }
      // Duration isn't in the basic endpoint's response; the player derives it
      // from the audio element on load (Phase 4).
      return { audio, format: req.format };
    },
  };
}
