import {
  CAPTURE_QUEUE,
  type CaptureJobData,
} from "@workspace/contracts/capture";
import {
  TRANSLATION_QUEUE,
  VOICE_QUEUE,
  type TranslationJobData,
  type VoiceJobData,
} from "@workspace/contracts/voice";
import { Queue } from "bullmq";

import { env } from "../env.js";

/**
 * Queue producers. The API only enqueues — all processing (and all AI keys)
 * live in apps/worker.
 */
const redisUrl = new URL(env.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  ...(redisUrl.password ? { password: redisUrl.password } : {}),
  maxRetriesPerRequest: null,
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 3000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 500 },
};

export const captureQueue = new Queue<CaptureJobData>(CAPTURE_QUEUE, {
  connection,
  defaultJobOptions,
});

/** Voice (narration + audio) jobs. */
export const voiceQueue = new Queue<VoiceJobData>(VOICE_QUEUE, {
  connection,
  defaultJobOptions,
});

/** Whole-guide translation jobs. */
export const translationQueue = new Queue<TranslationJobData>(
  TRANSLATION_QUEUE,
  { connection, defaultJobOptions }
);
