// env must be imported first — it validates configuration and fails fast.
import { env } from "./env.js";

import {
  CAPTURE_QUEUE,
  type CaptureJobData,
} from "@workspace/contracts/capture";
import {
  TRANSLATION_QUEUE,
  translationJobSchema,
  VOICE_QUEUE,
  voiceJobSchema,
  type TranslationJobData,
  type VoiceJobData,
} from "@workspace/contracts/voice";
import { createElevenLabsProvider, registerSpeechProvider } from "@workspace/ai";
import { prisma } from "@workspace/db";
import {
  collectOrphanRenders,
  generateNarrationForGuide,
  generateTranslation,
  setNarrationStatus,
  setTranslationStatus,
  synthesizeSegmentAudio,
} from "@workspace/generation";
import { Worker } from "bullmq";

import { processCapture } from "./pipeline/process-capture.js";
import { startReaper } from "./reaper.js";

/**
 * Tacto worker — consumes capture-processing jobs. Slow, failure-prone work
 * (AI calls, later: ffmpeg, image annotation) lives here so the API stays
 * fast. Scales horizontally by running more instances.
 */

// Connection as options (not an ioredis instance) — avoids type skew
// between bullmq's bundled ioredis and the workspace's.
const redisUrl = new URL(env.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  ...(redisUrl.password ? { password: redisUrl.password } : {}),
  // BullMQ requirement: never give up on Redis commands.
  maxRetriesPerRequest: null,
};

const worker = new Worker<CaptureJobData>(
  CAPTURE_QUEUE,
  async (job) => {
    console.log(`job ${job.id}: capture ${job.data.captureId} (attempt ${job.attemptsMade + 1})`);
    await processCapture(job.data.captureId);
  },
  {
    connection,
    concurrency: 3,
    // Recover jobs orphaned by a crashed/killed worker: if a job stops
    // reporting progress it's considered stalled and re-queued; after
    // maxStalledCount stalls it's moved to failed (→ capture marked FAILED).
    stalledInterval: 30_000,
    maxStalledCount: 2,
  }
);

worker.on("failed", async (job, error) => {
  console.error(`job ${job?.id} failed:`, error.message);
  // Mark the capture FAILED only when retries are exhausted.
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await prisma.capture
      .update({
        where: { id: job.data.captureId },
        data: { status: "FAILED", errorMessage: error.message },
      })
      .catch((updateError) =>
        console.error("could not mark capture FAILED:", updateError)
      );
  }
});

worker.on("ready", () => {
  console.log(`tacto worker ready — queue "${CAPTURE_QUEUE}"`);
});

// Register the TTS backend for audio synthesis (voice.synthesize jobs).
if (env.ELEVENLABS_API_KEY) {
  registerSpeechProvider(createElevenLabsProvider(env.ELEVENLABS_API_KEY));
} else {
  console.warn(
    "ELEVENLABS_API_KEY not set — voiceover audio synthesis will fail."
  );
}

// ── Voice (narration generation + audio synthesis) ────────────────────────
const voiceWorker = new Worker<VoiceJobData>(
  VOICE_QUEUE,
  async (job) => {
    const data = voiceJobSchema.parse(job.data);
    if (data.kind === "narration.generate") {
      const t0 = Date.now();
      await generateNarrationForGuide(data.guideId, data.language, {
        anchorKey: data.anchorKey,
        force: data.force,
      });
      await setNarrationStatus(data.guideId, data.language, "ready");
      console.log(
        `narration.generate ${data.guideId}/${data.language} in ${Date.now() - t0}ms`
      );
      return;
    }
    // voice.synthesize
    const t0 = Date.now();
    await synthesizeSegmentAudio(data.guideId, data.language, data.anchorKey);
    console.log(
      `voice.synthesize ${data.guideId}/${data.language}/${data.anchorKey} in ${Date.now() - t0}ms`
    );
  },
  { connection, concurrency: 4, stalledInterval: 30_000, maxStalledCount: 2 }
);

voiceWorker.on("failed", async (job, error) => {
  console.error(`voice job ${job?.id} failed:`, error.message);
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  const parsed = voiceJobSchema.safeParse(job.data);
  // narration.generate marks the narration failed; voice.synthesize already
  // marked its own MediaRender failed inside synthesizeSegmentAudio.
  if (parsed.success && parsed.data.kind === "narration.generate") {
    await setNarrationStatus(
      parsed.data.guideId,
      parsed.data.language,
      "failed",
      error.message
    );
  }
});

voiceWorker.on("ready", () =>
  console.log(`tacto worker ready — queue "${VOICE_QUEUE}"`)
);

// ── Translations (whole-guide, async) ─────────────────────────────────────
const translationWorker = new Worker<TranslationJobData>(
  TRANSLATION_QUEUE,
  async (job) => {
    const data = translationJobSchema.parse(job.data);
    await generateTranslation(data.guideId, data.language);
    await setTranslationStatus(data.guideId, data.language, "ready");
  },
  { connection, concurrency: 3, stalledInterval: 30_000, maxStalledCount: 2 }
);

translationWorker.on("failed", async (job, error) => {
  console.error(`translation job ${job?.id} failed:`, error.message);
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  const parsed = translationJobSchema.safeParse(job.data);
  if (parsed.success) {
    await setTranslationStatus(
      parsed.data.guideId,
      parsed.data.language,
      "failed",
      error.message
    );
  }
});

translationWorker.on("ready", () =>
  console.log(`tacto worker ready — queue "${TRANSLATION_QUEUE}"`)
);

// Self-healing sweep for captures orphaned outside the queue (abandoned
// uploads, jobs lost while the worker was down).
const reaperTimer = startReaper();

// Periodic GC of audio renders no segment resolves to anymore (superseded by a
// voice/text change). A grace window keeps in-flight builds safe.
const VOICE_GC_INTERVAL_MS = 30 * 60 * 1000;
async function sweepVoiceRenders() {
  try {
    const removed = await collectOrphanRenders();
    if (removed > 0) console.log(`voice GC: removed ${removed} orphan render(s)`);
  } catch (err) {
    console.error("voice GC failed:", err instanceof Error ? err.message : err);
  }
}
const voiceGcTimer = setInterval(() => void sweepVoiceRenders(), VOICE_GC_INTERVAL_MS);
void sweepVoiceRenders();

/** Graceful shutdown: finish in-flight jobs, then close connections. */
async function shutdown(signal: string) {
  console.log(`${signal} received — shutting down…`);
  clearInterval(reaperTimer);
  clearInterval(voiceGcTimer);
  await Promise.all([
    worker.close(),
    voiceWorker.close(),
    translationWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
