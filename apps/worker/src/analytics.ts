import { createServerAnalytics } from "@workspace/analytics/server";
import { prisma } from "@workspace/db";

import { env } from "./env.js";

/**
 * The worker's PostHog client — the single analytics entry point. No-op when
 * POSTHOG_KEY is unset. One instance per process; `analytics.shutdown()` is
 * called from the worker's graceful-shutdown handler so batched pipeline events
 * flush on deploy.
 */
export const analytics = createServerAnalytics({
  key: env.POSTHOG_KEY,
  host: env.POSTHOG_HOST,
  environment: env.NODE_ENV,
  buildSha: process.env.RAILWAY_GIT_COMMIT_SHA,
});

/**
 * Resolve the acting user + workspace for a guide, to attribute pipeline events
 * to the guide's owner. Returns null if analytics is off or the guide is gone.
 */
export async function guideActor(
  guideId: string
): Promise<{ userId: string; workspaceId: string } | null> {
  if (!analytics.enabled) return null;
  const guide = await prisma.guide.findUnique({
    where: { id: guideId },
    select: { createdById: true, organizationId: true },
  });
  return guide ? { userId: guide.createdById, workspaceId: guide.organizationId } : null;
}
