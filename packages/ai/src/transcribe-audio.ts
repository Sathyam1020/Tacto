import { openai } from "@ai-sdk/openai";
import { transcribe } from "ai";

/**
 * Narration transcription. Timestamped segments let the ingestion stage
 * hand each visual moment the words spoken around it — the single biggest
 * quality lever for video-derived guides.
 */

export type TranscriptSegment = {
  text: string;
  startSec: number;
  endSec: number;
};

export async function transcribeAudio(
  audio: Uint8Array
): Promise<TranscriptSegment[]> {
  const result = await transcribe({
    // Transcription models are provider-specific; OpenAI-only for now.
    model: openai.transcription("gpt-4o-mini-transcribe"),
    audio,
  });

  if (result.segments && result.segments.length > 0) {
    return result.segments.map((segment) => ({
      text: segment.text,
      startSec: segment.startSecond,
      endSec: segment.endSecond,
    }));
  }

  // Fallback: no segment timing — treat the whole transcript as one span.
  if (result.text.trim()) {
    return [
      {
        text: result.text,
        startSec: 0,
        endSec: result.durationInSeconds ?? Number.MAX_SAFE_INTEGER,
      },
    ];
  }

  return [];
}
