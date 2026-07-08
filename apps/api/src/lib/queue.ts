import {
  CAPTURE_QUEUE,
  type CaptureJobData,
} from "@workspace/contracts/capture";
import { Queue } from "bullmq";

import { env } from "../env.js";

/**
 * Queue producer. The API only enqueues — all processing (and all AI keys)
 * live in apps/worker.
 */
const redisUrl = new URL(env.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  ...(redisUrl.password ? { password: redisUrl.password } : {}),
  maxRetriesPerRequest: null,
};

export const captureQueue = new Queue<CaptureJobData>(CAPTURE_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});
