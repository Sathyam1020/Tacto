import { synthesizeGuide } from "@workspace/ai";
import type { CaptureEvent } from "@workspace/contracts/capture";
import { prisma } from "@workspace/db";

import { normalize } from "./normalize.js";
import { segment } from "./segment.js";

/**
 * The pipeline: Capture → normalize → segment → synthesize → assemble.
 * Each run is idempotent per capture: reprocessing replaces nothing —
 * it creates the Guide only on success, transactionally.
 */
export async function processCapture(captureId: string): Promise<void> {
  const capture = await prisma.capture.findUnique({
    where: { id: captureId },
  });
  if (!capture || capture.deletedAt) {
    throw new Error(`Capture ${captureId} not found`);
  }

  console.log(`[${captureId}] normalize…`);
  const events: CaptureEvent[] = normalize(capture.events);
  if (events.length === 0) {
    throw new Error("Capture contains no usable events after normalization");
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
        steps: {
          create: synthesized.steps.map((step, index) => {
            // Trace the step back to its source events for element metadata.
            const firstSourceIndex = step.sourceEventIndexes[0];
            const sourceEvent =
              firstSourceIndex !== undefined
                ? events[firstSourceIndex]
                : undefined;
            return {
              position: index + 1,
              instruction: step.instruction,
              elementLabel: step.elementLabel ?? null,
              url: step.url ?? sourceEvent?.url ?? null,
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
