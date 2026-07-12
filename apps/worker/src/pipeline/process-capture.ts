import { synthesizeGuide } from "@workspace/ai";
import type { CaptureEvent } from "@workspace/contracts/capture";
import { ensureDefaultFolder, prisma } from "@workspace/db";

import { ingestVideo } from "./ingest-video.js";
import { normalize } from "./normalize.js";
import { compileInteractions } from "./segment.js";
import { selectFrame } from "./select-frames.js";

/**
 * Normalized click rectangle (0–1 of the screenshot) from a source event's
 * boundingBox + viewport — the data the UI needs to place the click pointer.
 */
function clickRect(
  event: CaptureEvent | undefined
): { x: number; y: number; w: number; h: number } | undefined {
  if (!event || event.type === "navigation") return undefined
  const box = event.target.boundingBox
  const vp = event.viewport
  if (!box || !vp || vp.w <= 0 || vp.h <= 0) return undefined
  const clamp = (n: number) => Math.min(1, Math.max(0, n))
  return {
    x: clamp(box.x / vp.w),
    y: clamp(box.y / vp.h),
    w: clamp(box.w / vp.w),
    h: clamp(box.h / vp.h),
  }
}

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

  // Choke point: a Tacto guide is screenshots + pointers. If nothing carries a
  // screenshot, there's no guide to build — fail fast (no AI call, no retries)
  // with a clear message instead of producing an imageless "guide".
  if (!events.some((event) => event.screenshotId)) {
    console.log(`[${captureId}] no screenshots — failing without processing`);
    await prisma.capture.update({
      where: { id: captureId },
      data: {
        status: "FAILED",
        errorMessage: "No screenshots were captured — please record again.",
      },
    });
    return;
  }

  console.log(`[${captureId}] compile interactions… (${events.length} events)`);
  const interactions = compileInteractions(events);

  console.log(
    `[${captureId}] synthesize… (${interactions.length} interactions, model via env)`
  );
  const synthesized = await synthesizeGuide(events, interactions, {
    captureTitle: capture.title ?? undefined,
  });

  // Dismiss-mid-flight guard: if the user deleted this capture while we were
  // synthesizing, don't resurrect it into a guide.
  const stillLive = await prisma.capture.findUnique({
    where: { id: captureId },
    select: { deletedAt: true },
  });
  if (!stillLive || stillLive.deletedAt) {
    console.log(`[${captureId}] dismissed during processing — skipping`);
    return;
  }

  console.log(
    `[${captureId}] assemble… ("${synthesized.title}", ${synthesized.steps.length} steps)`
  );
  await prisma.$transaction(
    async (tx) => {
      // Land in the folder chosen at record time, else the workspace default.
      // (If that folder was deleted meanwhile, the SetNull FK already cleared
      // capture.folderId, so this safely falls back.)
      const folderId =
        capture.folderId ??
        (await ensureDefaultFolder(tx, capture.organizationId));

      // Deterministic Outcome step: if the FINAL interaction opened a new view
      // (absorbedNavigation) AND synthesis wrote a confirmation, append a
      // presentation-only block showing the destination. It never changes any
      // action step's frame — frame selection stays frozen.
      const terminal = interactions[interactions.length - 1];
      const outcomeText = synthesized.result?.text?.trim() || null;
      const lastIdx = terminal?.eventIndexes[terminal.eventIndexes.length - 1];
      const destEvent = lastIdx !== undefined ? events[lastIdx] : undefined;
      const outcomeFrame =
        destEvent?.frames?.after ??
        destEvent?.frames?.before ??
        (terminal ? events[terminal.primaryEventIndex]?.frames?.after : undefined) ??
        (terminal ? events[terminal.primaryEventIndex]?.frames?.before : undefined) ??
        null;
      const emitOutcome = !!(terminal?.absorbedNavigation && outcomeText);
      if (emitOutcome) {
        console.log(
          `[${captureId}]   outcome: frame=${outcomeFrame?.split("/").pop() ?? "none"} "${outcomeText}"`
        );
      }

      const guide = await tx.guide.create({
      data: {
        title: synthesized.title,
        summary: synthesized.summary,
        organizationId: capture.organizationId,
        captureId: capture.id,
        createdById: capture.createdById,
        folderId,
        blocks: {
          create: [
            ...synthesized.steps.map((step, index) => {
            // Trace the step back through its interaction to the primary source
            // event for element metadata + frame selection.
            const firstIx = step.sourceIndexes[0];
            const interaction =
              firstIx !== undefined ? interactions[firstIx] : undefined;
            const sourceEvent = interaction
              ? events[interaction.primaryEventIndex]
              : undefined;
            // Instruction-frame selection: choose the screenshot and whether a
            // pointer belongs on it, by instructional intent. An input borrows
            // the immediately-following click's before frame (strict adjacency).
            const nextEvent = interaction
              ? events[interaction.primaryEventIndex + 1]
              : undefined;
            const choice = sourceEvent
              ? selectFrame(sourceEvent, { nextEvent })
              : undefined;
            const showPointer = choice?.showPointer ?? false;
            // QA/debug: surface which frame each step used and where it came from
            // (its own before/after, or borrowed from the next click).
            console.log(
              `[${captureId}]   step ${index + 1} [${sourceEvent?.type ?? "?"}]: ` +
                `frame=${choice?.screenshotId?.split("/").pop() ?? "none"} ` +
                `source=${choice?.source ?? "none"} pointer=${showPointer}`
            );
            return {
              type: "STEP" as const,
              position: index + 1,
              // Synthesis emits markdown-bold; store as HTML rich text.
              content: markdownToHtml(step.instruction),
              elementLabel: step.elementLabel ?? null,
              url: step.url ?? sourceEvent?.url ?? null,
              // screenshotId is an R2 key; the API presigns it at read time.
              screenshotUrl:
                choice?.screenshotId ?? sourceEvent?.screenshotId ?? null,
              boundingBox:
                showPointer &&
                sourceEvent &&
                sourceEvent.type !== "navigation"
                  ? (sourceEvent.target.boundingBox ?? undefined)
                  : undefined,
              clickRect: showPointer ? clickRect(sourceEvent) : undefined,
              confidence: sourceEvent?.confidence ?? null,
            };
          }),
            ...(emitOutcome
              ? [
                  {
                    type: "OUTCOME" as const,
                    position: synthesized.steps.length + 1,
                    content: markdownToHtml(outcomeText!),
                    elementLabel: null,
                    url: terminal!.absorbedNavigation!.url,
                    screenshotUrl: outcomeFrame,
                    boundingBox: undefined,
                    clickRect: undefined,
                    confidence: null,
                  },
                ]
              : []),
          ],
        },
      },
    });

      await tx.capture.update({
        where: { id: capture.id },
        data: { status: "READY", errorMessage: null },
      });

      return guide;
    },
    // Neon's pooler can be slow to hand out a connection under load; the
    // default 2s maxWait was timing out ("Unable to start a transaction").
    { maxWait: 20_000, timeout: 30_000 }
  );

  console.log(`[${captureId}] done — capture READY`);
}
