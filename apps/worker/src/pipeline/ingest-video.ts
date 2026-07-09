import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  describeMoments,
  transcribeAudio,
  type Moment,
  type TranscriptSegment,
} from "@workspace/ai";
import {
  MAX_CAPTURE_DURATION_SEC,
  type CaptureEvent,
} from "@workspace/contracts/capture";
import { prisma } from "@workspace/db";
import { getObjectBytes, putObject } from "@workspace/storage";

import {
  detectSceneChanges,
  extractAudio,
  extractFrame,
  probe,
} from "./ffmpeg.js";

/**
 * Video ingestion: reconstruct the normalized event log from a screen
 * recording. Produces the same CaptureEvent[] the extension emits —
 * everything downstream (normalize → synthesize → assemble) is shared.
 */
export async function ingestVideo(capture: {
  id: string;
  videoKey: string | null;
}): Promise<CaptureEvent[]> {
  if (!capture.videoKey) {
    throw new Error("Video capture has no videoKey");
  }

  const workDir = await mkdtemp(join(tmpdir(), "tacto-ingest-"));
  try {
    // 1. Fetch the recording from R2.
    console.log(`[${capture.id}] fetch video…`);
    const videoBytes = await getObjectBytes(capture.videoKey);
    const videoPath = join(workDir, "raw-video");
    await writeFile(videoPath, videoBytes);

    // 2. Probe: duration cap + audio detection.
    const { durationSec, hasAudio } = await probe(videoPath);
    console.log(
      `[${capture.id}] probe: ${durationSec.toFixed(1)}s, audio: ${hasAudio}`
    );
    if (durationSec > MAX_CAPTURE_DURATION_SEC) {
      throw new Error(
        `Recording is ${Math.round(durationSec)}s — the limit is ${MAX_CAPTURE_DURATION_SEC}s (5 minutes)`
      );
    }
    await prisma.capture.update({
      where: { id: capture.id },
      data: { durationSec },
    });

    // 3. Transcribe narration when present.
    let transcript: TranscriptSegment[] = [];
    if (hasAudio) {
      console.log(`[${capture.id}] transcribe…`);
      const audioPath = join(workDir, "audio.wav");
      await extractAudio(videoPath, audioPath);
      transcript = await transcribeAudio(await readFile(audioPath));
      console.log(`[${capture.id}] transcript: ${transcript.length} segments`);
    }

    // 4. Detect visual moments (scene changes ∪ uniform grid).
    const timestamps = await detectSceneChanges(videoPath, durationSec);
    console.log(`[${capture.id}] moments: ${timestamps.length}`);

    // 5. Extract before/after frames; upload before-frames as screenshots.
    const moments: Moment[] = [];
    for (const [index, timeSec] of timestamps.entries()) {
      const beforeAt = Math.max(0, timeSec - 0.15);
      const afterAt = Math.min(durationSec - 0.05, timeSec + 0.35);
      const beforeFrame = await extractFrame(videoPath, beforeAt);
      const afterFrame = await extractFrame(videoPath, afterAt);

      const screenshotId = `frames/${capture.id}/${String(index).padStart(4, "0")}.jpg`;
      await putObject(screenshotId, afterFrame, "image/jpeg");

      moments.push({ timeSec, beforeFrame, afterFrame, screenshotId });
    }
    console.log(`[${capture.id}] frames extracted + uploaded`);

    // 6. Vision: what did the user do at each moment?
    const events = await describeMoments(moments, transcript);
    console.log(
      `[${capture.id}] understood: ${events.length}/${moments.length} moments meaningful`
    );

    // 7. Persist derived events (raw video in R2 stays the immutable source).
    await prisma.capture.update({
      where: { id: capture.id },
      data: { events },
    });

    return events;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
