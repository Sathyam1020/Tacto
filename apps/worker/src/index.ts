// env must be imported first — it validates configuration and fails fast.
import { env } from "./env.js";

import {
  CAPTURE_QUEUE,
  type CaptureJobData,
} from "@workspace/contracts/capture";
import { prisma } from "@workspace/db";
import { Worker } from "bullmq";

import { processCapture } from "./pipeline/process-capture.js";

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

/** Graceful shutdown: finish in-flight jobs, then close connections. */
async function shutdown(signal: string) {
  console.log(`${signal} received — shutting down…`);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
