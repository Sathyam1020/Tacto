import { createServerAnalytics } from "@workspace/analytics/server";

import { env } from "../env.js";

/**
 * The API's PostHog client — the single analytics entry point for the server.
 * No-op when POSTHOG_KEY is unset (local/preview). One instance per process;
 * `analytics.shutdown()` is called from the graceful-shutdown handler in
 * index.ts so batched events flush on deploy.
 */
export const analytics = createServerAnalytics({
  key: env.POSTHOG_KEY,
  host: env.POSTHOG_HOST,
  environment: env.NODE_ENV,
  buildSha: process.env.RAILWAY_GIT_COMMIT_SHA,
});
