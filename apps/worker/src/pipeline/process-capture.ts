import { synthesizeGuide } from "@workspace/ai";
import type { CaptureEvent } from "@workspace/contracts/capture";
import { prisma } from "@workspace/db";

import { ingestVideo } from "./ingest-video.js";
import { normalize } from "./normalize.js";
import { segment } from "./segment.js";

/** Convert the synthesizer's markdown-bold plain text to safe HTML. */
function markdownToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const bolded = escaped.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );
  return `<p>${bolded}</p>`;
}

/**
 * The pipeline: Capture → [video ingestion] → normalize → segment →
 * synthesize → assemble. Each run is idempotent per capture: reprocessing
 * replaces nothing — it creates the Guide only on success, transactionally.
 */
export async function processCapture(captureId: string): Promise<void> {
  const capture = await prisma.capture.findUnique({
    where: { id: captureId },
  });
  if (!capture || capture.deletedAt) {
    throw new Error(`Capture ${captureId} not found`);
  }

  // Video captures first reconstruct their event log from the recording.
  // An empty array is NOT "already ingested" — a prior run may have found
  // nothing; reprocessing should try ingestion again (prompts improve).
  let rawEvents: unknown = capture.events;
  const hasEvents = Array.isArray(capture.events)
    ? capture.events.length > 0
    : capture.events != null;
  if (capture.source === "VIDEO_UPLOAD" && !hasEvents) {
    rawEvents = await ingestVideo(capture);
  }
  if (!rawEvents) {
    throw new Error("Capture has no events to process");
  }

  console.log(`[${captureId}] normalize…`);
  const events: CaptureEvent[] = normalize(rawEvents);
  if (events.length === 0) {
    throw new Error(
      "No usable actions found in this capture — try recording with clearer interactions"
    );
  }

  console.log(`[${captureId}] segment… (${events.length} events)`);
  const segments = segment(events);

  console.log(
    `[${captureId}] synthesize… (${segments.length} segments, model via env)`
  );
  const synthesized = await synthesizeGuide(events, {
    captureTitle: capture.title ?? undefined,
  });

  console.log(
    `[${captureId}] assemble… ("${synthesized.title}", ${synthesized.steps.length} steps)`
  );
  await prisma.$transaction(async (tx) => {
    const guide = await tx.guide.create({
      data: {
        title: synthesized.title,
        summary: synthesized.summary,
        organizationId: capture.organizationId,
        captureId: capture.id,
        createdById: capture.createdById,
        blocks: {
          create: synthesized.steps.map((step, index) => {
            // Trace the step back to its source events for element metadata.
            const firstSourceIndex = step.sourceEventIndexes[0];
            const sourceEvent =
              firstSourceIndex !== undefined
                ? events[firstSourceIndex]
                : undefined;
            return {
              type: "STEP" as const,
              position: index + 1,
              // Synthesis emits markdown-bold; store as HTML rich text.
              content: markdownToHtml(step.instruction),
              elementLabel: step.elementLabel ?? null,
              url: step.url ?? sourceEvent?.url ?? null,
              // screenshotId is an R2 key; the API presigns it at read time.
              screenshotUrl: sourceEvent?.screenshotId ?? null,
              boundingBox:
                sourceEvent && sourceEvent.type !== "navigation"
                  ? (sourceEvent.target.boundingBox ?? undefined)
                  : undefined,
              confidence: sourceEvent?.confidence ?? null,
            };
          }),
        },
      },
    });

    await tx.capture.update({
      where: { id: capture.id },
      data: { status: "READY", errorMessage: null },
    });

    return guide;
  });

  console.log(`[${captureId}] done — capture READY`);
}
