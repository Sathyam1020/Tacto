import { prisma } from "@workspace/db";

import { env } from "./env.js";

/**
 * Stuck-capture reaper.
 *
 * The capture lifecycle is UPLOADING → PROCESSING → READY/FAILED. Two states
 * can hang forever without a safety net:
 *
 *  - UPLOADING: the client (extension/browser) created the capture but never
 *    finished uploading + submitting — tab closed, upload failed, crash. No
 *    job is ever enqueued, so nothing else will touch it.
 *  - PROCESSING: a job was enqueued but the worker died mid-flight, Redis lost
 *    the job, or it stalled past recovery. BullMQ's `failed` event only fires
 *    inside a live worker, so these orphan too.
 *
 * This sweep forces both back to a terminal FAILED state with a clear,
 * user-facing message, so the UI can show Retry/Dismiss instead of a ghost
 * card that spins forever. It's idempotent and safe to run concurrently.
 */
export async function reapStuckCaptures(): Promise<{
  uploads: number;
  processing: number;
}> {
  const now = Date.now();
  const uploadCutoff = new Date(now - env.STUCK_UPLOAD_TIMEOUT_MIN * 60_000);
  const processingCutoff = new Date(
    now - env.STUCK_PROCESSING_TIMEOUT_MIN * 60_000
  );

  // Abandoned uploads: nothing updates an UPLOADING row, so createdAt is the
  // age. These have no data to process → the UI will offer Dismiss only.
  const uploads = await prisma.capture.updateMany({
    where: {
      status: "UPLOADING",
      deletedAt: null,
      createdAt: { lt: uploadCutoff },
    },
    data: {
      status: "FAILED",
      errorMessage: "Upload didn't finish. Please record again.",
    },
  });

  // Lost/dead processing jobs: updatedAt is when it entered PROCESSING.
  const processing = await prisma.capture.updateMany({
    where: {
      status: "PROCESSING",
      deletedAt: null,
      updatedAt: { lt: processingCutoff },
    },
    data: {
      status: "FAILED",
      errorMessage: "Processing timed out. Retry or dismiss this capture.",
    },
  });

  if (uploads.count || processing.count) {
    console.log(
      `reaper: failed ${uploads.count} stuck upload(s), ${processing.count} stuck processing`
    );
  }
  return { uploads: uploads.count, processing: processing.count };
}

/** Start the periodic sweep; runs once immediately, then on an interval. */
export function startReaper(): NodeJS.Timeout {
  void reapStuckCaptures().catch((error) =>
    console.error("reaper: initial sweep failed:", error)
  );
  const timer = setInterval(() => {
    void reapStuckCaptures().catch((error) =>
      console.error("reaper: sweep failed:", error)
    );
  }, env.REAPER_INTERVAL_SEC * 1000);
  // Don't keep the process alive solely for the reaper.
  timer.unref();
  console.log(
    `reaper: sweeping every ${env.REAPER_INTERVAL_SEC}s ` +
      `(upload>${env.STUCK_UPLOAD_TIMEOUT_MIN}m, processing>${env.STUCK_PROCESSING_TIMEOUT_MIN}m)`
  );
  return timer;
}
